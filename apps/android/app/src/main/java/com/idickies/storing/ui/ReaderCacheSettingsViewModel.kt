package com.idickies.storing.ui

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.idickies.storing.cache.CacheManager
import com.idickies.storing.offline.OfflineDownloadManager
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ReaderCacheSettingsUiState(
  val automaticBytes: Long = 0L,
  val automaticCount: Int = 0,
  val imageBytes: Long = 0L,
  val loading: Boolean = true,
  val clearing: Boolean = false,
) {
  val clearableBytes: Long get() = automaticBytes + imageBytes
}

@HiltViewModel
class ReaderCacheSettingsViewModel @Inject constructor(
  @ApplicationContext private val context: Context,
  private val offlineDownloadManager: OfflineDownloadManager,
) : ViewModel() {
  private val mutableState = MutableStateFlow(ReaderCacheSettingsUiState())
  val state = mutableState.asStateFlow()

  init {
    refresh()
  }

  fun refresh() {
    viewModelScope.launch {
      val automaticBytes = offlineDownloadManager.automaticCacheSize()
      val automaticCount = offlineDownloadManager.automaticCacheCount()
      val imageBytes = CacheManager.imageCacheSize(context)
      mutableState.update {
        it.copy(
          automaticBytes = automaticBytes,
          automaticCount = automaticCount,
          imageBytes = imageBytes,
          loading = false,
        )
      }
    }
  }

  fun clearReaderCache() {
    if (mutableState.value.clearing) return
    viewModelScope.launch {
      mutableState.update { it.copy(clearing = true) }
      offlineDownloadManager.clearAutomaticCache()
      CacheManager.clearImageCache(context)
      mutableState.update { it.copy(clearing = false) }
      refresh()
    }
  }
}
