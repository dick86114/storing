package com.idickies.storing.collect

import android.content.Context
import com.idickies.storing.auth.AuthRepository
import com.idickies.storing.auth.LoginCredentials
import com.idickies.storing.auth.MobileAuthResult
import com.idickies.storing.auth.MobileNetworkUnavailableException
import com.idickies.storing.auth.SessionStore
import com.idickies.storing.database.PendingCollectSubmission
import com.idickies.storing.database.PendingCollectSubmissionDao
import com.idickies.storing.database.PendingAuthActionDao
import com.idickies.storing.database.PendingAuthActionEntity
import com.idickies.storing.database.PendingAuthActionFileEntity
import com.idickies.storing.network.WeChatImportResult
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import okhttp3.MediaType.Companion.toMediaTypeOrNull
import okhttp3.MultipartBody
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File
import javax.inject.Inject

/** 已复制到应用私有目录的分享文件，content URI 的临时读权限在分享界面退出后即失效。 */
data class SharedImportFile(
  val displayName: String,
  val cacheFile: File,
  val size: Long,
)

data class ShareCollectUiState(
  val urls: List<String> = emptyList(),
  val selectedUrl: String? = null,
  val importFiles: List<SharedImportFile> = emptyList(),
  val submitting: Boolean = false,
  val message: String? = null,
  val submittedJobId: Int? = null,
  val importedArticleId: Int? = null,
  val submissionAccepted: Boolean = false,
  val loginRequired: Boolean = false,
)

internal sealed interface PendingShareAction {
  data class CollectUrl(val url: String, val source: String) : PendingShareAction
  data class ImportFiles(val files: List<SharedImportFile>) : PendingShareAction
}

internal fun com.idickies.storing.database.PendingAuthActionWithFiles.toPendingShareAction(
  resolveExistingFile: (String) -> File?,
): PendingShareAction? = when (action.kind) {
  "collect_url" -> action.url?.let { PendingShareAction.CollectUrl(it, action.source ?: "android_share") }
  "import_files" -> files.mapNotNull { file ->
    resolveExistingFile(file.filePath)?.let { SharedImportFile(file.displayName, it, file.sizeBytes) }
  }.takeIf { it.isNotEmpty() }?.let(PendingShareAction::ImportFiles)
  else -> null
}

internal fun shouldDismissManualCollectDialog(
  submittedByThisDialog: Boolean,
  submissionAccepted: Boolean,
): Boolean = submittedByThisDialog && submissionAccepted

@HiltViewModel
class ShareCollectViewModel @Inject constructor(
  private val collectRepository: CollectRepository,
  private val weChatImportRepository: WeChatImportRepository,
  private val sessionStore: SessionStore,
  private val pendingSubmissionDao: PendingCollectSubmissionDao,
  private val pendingAuthActionDao: PendingAuthActionDao,
  private val authRepository: AuthRepository,
  @ApplicationContext private val context: Context,
) : ViewModel() {
  private val mutableState = MutableStateFlow(ShareCollectUiState())
  val state = mutableState.asStateFlow()
  private var pendingAction: PendingShareAction? = null

  init {
    viewModelScope.launch { restorePendingAction() }
  }

  private suspend fun restorePendingAction() {
    val saved = pendingAuthActionDao.latestWithFiles() ?: return
    val action = saved.toPendingShareAction { path ->
      File(path).takeIf { it.exists() }
    } ?: run {
      pendingAuthActionDao.clearAll()
      return
    }
    pendingAction = action
    mutableState.update { current ->
      when (action) {
        is PendingShareAction.CollectUrl -> current.copy(
          urls = listOf(action.url),
          selectedUrl = action.url,
          loginRequired = true,
          message = "登录后将继续采集该链接",
        )
        is PendingShareAction.ImportFiles -> current.copy(
          importFiles = action.files,
          loginRequired = true,
          message = "登录后将继续导入所选文件",
        )
      }
    }
  }

  private suspend fun persistPendingAction(action: PendingShareAction) {
    when (action) {
      is PendingShareAction.CollectUrl -> pendingAuthActionDao.save(
        PendingAuthActionEntity(kind = KIND_URL, url = action.url, source = action.source),
        emptyList(),
      )
      is PendingShareAction.ImportFiles -> pendingAuthActionDao.save(
        PendingAuthActionEntity(kind = KIND_IMPORT),
        action.files.mapIndexed { index, file ->
          PendingAuthActionFileEntity(
            actionId = 0,
            sortOrder = index,
            displayName = file.displayName,
            filePath = file.cacheFile.absolutePath,
            sizeBytes = file.size,
          )
        },
      )
    }
  }

  private suspend fun clearPendingAction() {
    pendingAction = null
    pendingAuthActionDao.clearAll()
  }

  private companion object {
    const val KIND_URL = "collect_url"
    const val KIND_IMPORT = "import_files"
  }

  fun receiveSharedText(text: String) {
    if (pendingAction != null && mutableState.value.loginRequired) return
    val content = ShareTargetContent.from(text)
    mutableState.value = ShareCollectUiState(
      urls = content.urls,
      selectedUrl = content.selectedUrl,
      message = content.message,
    )
  }

  fun receiveSharedFiles(files: List<SharedImportFile>) {
    if (pendingAction != null && mutableState.value.loginRequired) return
    mutableState.value = ShareCollectUiState(
      importFiles = files,
      message = if (files.isEmpty()) "没有收到可导入的文件" else null,
    )
  }

  fun select(url: String) = mutableState.update { it.copy(selectedUrl = url) }

  fun clearSubmissionResult() {
    mutableState.update { it.copy(message = null, submittedJobId = null, submissionAccepted = false) }
  }

  fun submitManual(rawUrl: String) {
    val url = ManualCollectUrl.normalize(rawUrl)
    if (url == null) {
      mutableState.update { it.copy(message = "请输入有效的 http 或 https 链接") }
      return
    }
    submitUrl(url, "android")
  }

  fun submit() {
    val url = mutableState.value.selectedUrl ?: return
    submitUrl(url, "android_share")
  }

  fun submitImport() {
    val files = mutableState.value.importFiles
    if (files.isEmpty() || mutableState.value.submitting) return
    viewModelScope.launch {
      mutableState.update { it.copy(submitting = true, message = null, importedArticleId = null, submissionAccepted = false) }
      runCatching {
        val parts = files.map { file ->
          val mediaType = guessMediaType(file.displayName)
          MultipartBody.Part.createFormData(
            "files",
            file.displayName,
            file.cacheFile.asRequestBody(mediaType),
          )
        }
        // 服务端统一识别 ZIP/聊天记录/散媒体，客户端只声明来源。
        val manifest = """{"source":"android"}""".toRequestBody("application/json".toMediaTypeOrNull())
        weChatImportRepository.import(parts, manifest)
      }
        .onSuccess { result: WeChatImportResult ->
          clearPendingAction()
          mutableState.update {
            it.copy(
              submitting = false,
              message = "已保存到乾坤戒 #${result.articleId}",
              importedArticleId = result.articleId,
              submissionAccepted = true,
            )
          }
        }
        .onFailure { error ->
          if (error is MobileAuthenticationRequiredException) {
            val action = PendingShareAction.ImportFiles(files)
            pendingAction = action
            persistPendingAction(action)
            mutableState.update { it.copy(submitting = false, loginRequired = true, message = "登录后将继续导入所选文件") }
          } else if (error is MobileNetworkUnavailableException) {
            mutableState.update { it.copy(submitting = false, message = "网络连接失败，请稍后重试") }
          } else {
            mutableState.update { it.copy(submitting = false, message = error.message ?: "微信内容导入失败") }
          }
        }
    }
  }

  private fun submitUrl(url: String, source: String) {
    if (mutableState.value.submitting) return
    viewModelScope.launch {
      mutableState.update { it.copy(submitting = true, message = null, submittedJobId = null, submissionAccepted = false) }
      runCatching { collectRepository.submit(url, source) }
        .onSuccess { job ->
          clearPendingAction()
          CollectTrackingScheduler.schedule(context, job.id)
          mutableState.update { it.copy(submitting = false, message = "已加入采集队列 #${job.id}", submittedJobId = job.id, submissionAccepted = true) }
        }
        .onFailure { error ->
          if (error is MobileAuthenticationRequiredException) {
            val action = PendingShareAction.CollectUrl(url, source)
            pendingAction = action
            persistPendingAction(action)
            mutableState.update { it.copy(submitting = false, loginRequired = true, message = "登录后将继续采集该链接") }
          } else if (error is MobileNetworkUnavailableException) {
            mutableState.update { it.copy(submitting = false, message = "网络连接失败，请稍后重试") }
          } else if (PendingCollectSubmissionPolicy.shouldQueue(error) && queueForRetry(url, source)) {
            mutableState.update { it.copy(submitting = false, message = "网络不可用，已保存，恢复连接后会自动提交", submissionAccepted = true) }
          } else {
            mutableState.update { it.copy(submitting = false, message = error.message ?: "提交采集失败") }
          }
        }
    }
  }

  private suspend fun queueForRetry(url: String, source: String): Boolean {
    val userId = sessionStore.read()?.userId ?: return false
    pendingSubmissionDao.insert(PendingCollectSubmission(userId = userId, url = url, source = source))
    PendingCollectSubmissionScheduler.schedule(context)
    return true
  }

  fun resumePendingSubmissions() = PendingCollectSubmissionScheduler.schedule(context)

  fun cancelLogin() = mutableState.update { it.copy(loginRequired = false) }

  fun login(credentials: LoginCredentials) {
    if (!credentials.isSubmittable || mutableState.value.submitting) return
    viewModelScope.launch {
      mutableState.update { it.copy(submitting = true) }
      val result = runCatching { authRepository.login(credentials.normalizedUsername, credentials.password) }
      val value = result.getOrNull()
      if (value != null) {
        mutableState.update { it.copy(submitting = false, loginRequired = false, message = "登录成功，正在继续采集") }
        submitAfterLogin()
      } else {
        mutableState.update { it.copy(submitting = false, message = "登录失败，请检查账号密码") }
      }
    }
  }

  private fun submitAfterLogin() {
    when (val action = pendingAction) {
      is PendingShareAction.CollectUrl -> submitUrl(action.url, action.source)
      is PendingShareAction.ImportFiles -> submitImport()
      null -> Unit
    }
  }

  private fun guessMediaType(filename: String) =
    when (filename.substringAfterLast('.', "").lowercase()) {
      "png" -> "image/png"
      "jpg", "jpeg" -> "image/jpeg"
      "webp" -> "image/webp"
      "gif" -> "image/gif"
      "mp4", "m4v" -> "video/mp4"
      "mov" -> "video/quicktime"
      "mp3" -> "audio/mpeg"
      "m4a" -> "audio/mp4"
      "txt" -> "text/plain"
      "html", "htm" -> "text/html"
      else -> "application/octet-stream"
    }.toMediaTypeOrNull()
}
