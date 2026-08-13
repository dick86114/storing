package com.idickies.storing.update

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.idickies.storing.BuildConfig
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

data class UpdateUiState(
  val release: AndroidRelease? = null,
  val checking: Boolean = false,
  val downloading: Boolean = false,
  val updateStage: UpdateStage? = null,
  val downloadProgress: Float? = null,
  val installationStarted: Boolean = false,
  val error: String? = null,
  val statusMessage: String? = null,
)

@HiltViewModel
class UpdateViewModel @Inject constructor(
  private val repository: UpdateRepository,
  private val installer: UpdateInstaller,
) : ViewModel() {
  private val mutableState = MutableStateFlow(UpdateUiState())
  val state = mutableState.asStateFlow()

  fun checkOnLaunch() = check(manual = false)

  fun checkNow() = check(manual = true)

  private fun check(manual: Boolean) = viewModelScope.launch {
    mutableState.value = mutableState.value.copy(checking = manual, error = null, statusMessage = null)
    runCatching { if (manual) repository.checkNow() else repository.checkOnLaunch() }
      .onSuccess { release ->
        mutableState.value = when {
          release != null && AndroidReleaseUpdatePolicy.shouldPrompt(BuildConfig.VERSION_CODE, release) -> UpdateUiState(release = release)
          manual -> UpdateUiState(statusMessage = "当前已是最新版本")
          else -> UpdateUiState()
        }
      }
      .onFailure { error ->
        mutableState.value = if (manual) UpdateUiState(error = error.message ?: "检查更新失败") else UpdateUiState()
      }
  }

  fun dismiss() { mutableState.value = UpdateUiState() }

  fun ignore() {
    val release = mutableState.value.release ?: return
    repository.ignore(release)
    mutableState.value = UpdateUiState()
  }

  fun download() {
    val release = mutableState.value.release ?: return
    viewModelScope.launch {
      mutableState.value = mutableState.value.copy(downloading = true, updateStage = UpdateStage.DOWNLOADING, downloadProgress = 0f, error = null)
      runCatching {
        installer.downloadVerifyAndInstall(release) { stage, progress ->
          mutableState.value = mutableState.value.copy(updateStage = stage, downloadProgress = progress)
        }
      }.onSuccess {
        mutableState.value = mutableState.value.copy(
          downloading = false,
          updateStage = null,
          downloadProgress = null,
          installationStarted = true,
        )
      }.onFailure { error ->
        mutableState.value = mutableState.value.copy(downloading = false, updateStage = null, downloadProgress = null, error = error.message ?: "下载更新失败")
      }
    }
  }
}
