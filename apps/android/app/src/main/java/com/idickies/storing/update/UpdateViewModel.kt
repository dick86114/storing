package com.idickies.storing.update

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.idickies.storing.BuildConfig
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class UpdateUiState(val release: AndroidRelease? = null, val downloading: Boolean = false, val error: String? = null)

@HiltViewModel
class UpdateViewModel @Inject constructor(
  private val repository: UpdateRepository,
  private val installer: UpdateInstaller,
) : ViewModel() {
  private val mutableState = MutableStateFlow(UpdateUiState())
  val state = mutableState.asStateFlow()

  fun checkOnLaunch() = viewModelScope.launch {
    runCatching { repository.checkOnLaunch() }
      .onSuccess { release -> if (release != null && AndroidReleaseUpdatePolicy.shouldPrompt(BuildConfig.VERSION_CODE, release)) mutableState.value = UpdateUiState(release = release) }
  }

  fun dismiss() { mutableState.value = UpdateUiState() }

  fun download() {
    val release = mutableState.value.release ?: return
    viewModelScope.launch {
      mutableState.value = mutableState.value.copy(downloading = true, error = null)
      runCatching { installer.downloadVerifyAndInstall(release) }
        .onFailure { error -> mutableState.value = mutableState.value.copy(downloading = false, error = error.message ?: "下载更新失败") }
    }
  }
}
