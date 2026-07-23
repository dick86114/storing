package com.idickies.storing.collect

import android.content.Context
import com.idickies.storing.auth.SessionStore
import com.idickies.storing.database.PendingCollectSubmission
import com.idickies.storing.database.PendingCollectSubmissionDao
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ShareCollectUiState(
  val urls: List<String> = emptyList(),
  val selectedUrl: String? = null,
  val submitting: Boolean = false,
  val message: String? = null,
  val submittedJobId: Int? = null,
  val submissionAccepted: Boolean = false,
)

@HiltViewModel
class ShareCollectViewModel @Inject constructor(
  private val collectRepository: CollectRepository,
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

  fun select(url: String) = mutableState.update { it.copy(selectedUrl = url) }

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
          if (PendingCollectSubmissionPolicy.shouldQueue(error) && queueForRetry(url, source)) {
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
}
