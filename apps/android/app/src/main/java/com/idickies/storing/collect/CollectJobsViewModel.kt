package com.idickies.storing.collect

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.idickies.storing.network.MobileCollectJob
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class CollectJobsUiState(
  val jobs: List<MobileCollectJob> = emptyList(),
  val loading: Boolean = true,
  val error: String? = null,
) {
  val activeJobCount: Int get() = jobs.count { !it.isTerminal }
}

@HiltViewModel
class CollectJobsViewModel @Inject constructor(
  private val repository: CollectRepository,
) : ViewModel() {
  private val mutableState = MutableStateFlow(CollectJobsUiState())
  val state = mutableState.asStateFlow()
  private var pollingJob: Job? = null
  private val completionTracker = CollectCompletionTracker()
  private val mutableCompletionEvents = MutableSharedFlow<MobileCollectJob>(extraBufferCapacity = 1)
  val completionEvents = mutableCompletionEvents.asSharedFlow()

  fun start() {
    if (pollingJob != null) return
    pollingJob = viewModelScope.launch {
      while (true) {
        refresh()
        delay(if (mutableState.value.jobs.any { !it.isTerminal }) 3_000 else 15_000)
      }
    }
  }

  fun stop() { pollingJob?.cancel(); pollingJob = null }

  fun refresh() {
    viewModelScope.launch {
      runCatching { repository.jobs() }
        .onSuccess { jobs ->
          completionTracker.observe(jobs).forEach { mutableCompletionEvents.tryEmit(it) }
          mutableState.value = CollectJobsUiState(jobs = jobs, loading = false)
        }
        .onFailure { error -> mutableState.update { it.copy(loading = false, error = error.message ?: "加载采集任务失败") } }
    }
  }

  fun retry(id: Int) = viewModelScope.launch {
    runCatching { repository.retry(id) }.onSuccess { refresh() }
  }

  fun clearFinished() = viewModelScope.launch {
    runCatching { repository.clearFinished() }.onSuccess { refresh() }
  }

  override fun onCleared() { stop() }
}
