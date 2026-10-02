package com.idickies.storing.collect

import android.content.Context
import com.idickies.storing.auth.SessionStore
import com.idickies.storing.database.PendingCollectSubmission
import com.idickies.storing.database.PendingCollectSubmissionDao
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
)

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
  @ApplicationContext private val context: Context,
) : ViewModel() {
  private val mutableState = MutableStateFlow(ShareCollectUiState())
  val state = mutableState.asStateFlow()

  fun receiveSharedText(text: String) {
    val content = ShareTargetContent.from(text)
    mutableState.value = ShareCollectUiState(
      urls = content.urls,
      selectedUrl = content.selectedUrl,
      message = content.message,
    )
  }

  fun receiveSharedFiles(files: List<SharedImportFile>) {
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
          val message = if (error is MobileAuthenticationRequiredException) {
            error.message
          } else {
            error.message ?: "微信内容导入失败"
          }
          mutableState.update { it.copy(submitting = false, message = message) }
        }
    }
  }

  private fun submitUrl(url: String, source: String) {
    if (mutableState.value.submitting) return
    viewModelScope.launch {
      mutableState.update { it.copy(submitting = true, message = null, submittedJobId = null, submissionAccepted = false) }
      runCatching { collectRepository.submit(url, source) }
        .onSuccess { job ->
          CollectTrackingScheduler.schedule(context, job.id)
          mutableState.update { it.copy(submitting = false, message = "已加入采集队列 #${job.id}", submittedJobId = job.id, submissionAccepted = true) }
        }
        .onFailure { error ->
          if (error is MobileAuthenticationRequiredException) {
            mutableState.update { it.copy(submitting = false, message = error.message) }
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
