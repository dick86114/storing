package com.idickies.storing.collect

import android.content.Context
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
)

@HiltViewModel
class ShareCollectViewModel @Inject constructor(
  private val collectRepository: CollectRepository,
  @ApplicationContext private val context: Context,
) : ViewModel() {
  private val mutableState = MutableStateFlow(ShareCollectUiState())
  val state = mutableState.asStateFlow()

  fun receiveSharedText(text: String) {
    val urls = SharedUrlExtractor.extract(text)
    mutableState.value = ShareCollectUiState(
      urls = urls,
      selectedUrl = urls.firstOrNull(),
      message = if (urls.isEmpty()) "未识别到可采集的网页链接" else null,
    )
  }

  fun select(url: String) = mutableState.update { it.copy(selectedUrl = url) }

  fun submit() {
    val url = mutableState.value.selectedUrl ?: return
    if (mutableState.value.submitting) return
    viewModelScope.launch {
      mutableState.update { it.copy(submitting = true, message = null) }
      runCatching { collectRepository.submitSharedUrl(url) }
        .onSuccess { job ->
          CollectTrackingScheduler.schedule(context, job.id)
          mutableState.update { it.copy(submitting = false, message = "已加入采集队列 #${job.id}") }
        }
        .onFailure { error -> mutableState.update { it.copy(submitting = false, message = error.message ?: "提交采集失败") } }
    }
  }
}
