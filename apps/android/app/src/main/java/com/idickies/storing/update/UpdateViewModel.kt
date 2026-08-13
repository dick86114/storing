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
  val updateSource: UpdateSource = UpdateSource.Official,
  val error: String? = null,
  val suggestChangeSource: Boolean = false,
  val statusMessage: String? = null,
)

@HiltViewModel
class UpdateViewModel @Inject constructor(
  private val repository: UpdateRepository,
  private val installer: UpdateInstaller,
) : ViewModel() {
  private val mutableState = MutableStateFlow(UpdateUiState(updateSource = repository.updateSource()))
  val state = mutableState.asStateFlow()

  fun checkOnLaunch() = check(manual = false)

  fun checkNow() = check(manual = true)

  private fun check(manual: Boolean) = viewModelScope.launch {
    val selectedSource = mutableState.value.updateSource
    mutableState.value = mutableState.value.copy(checking = manual, error = null, suggestChangeSource = false, statusMessage = null)
    runCatching { if (manual) repository.checkNow() else repository.checkOnLaunch() }
      .onSuccess { release ->
        mutableState.value = when {
          release != null && AndroidReleaseUpdatePolicy.shouldPrompt(BuildConfig.VERSION_CODE, release) -> UpdateUiState(release = release, updateSource = selectedSource)
          manual -> UpdateUiState(statusMessage = "当前已是最新版本", updateSource = selectedSource)
          else -> UpdateUiState(updateSource = selectedSource)
        }
      }
      .onFailure { error ->
        val failureKind = classifyUpdateFailure(error)
        mutableState.value = if (manual) {
          UpdateUiState(
            error = when (failureKind) {
              UpdateFailureKind.Network -> "当前更新源连接失败或响应过慢，请更换更新源后重试。"
              UpdateFailureKind.Server -> "当前更新源暂时不可用，请更换更新源后重试。"
              UpdateFailureKind.Other -> error.message ?: "检查更新失败"
            },
            suggestChangeSource = failureKind != UpdateFailureKind.Other,
            updateSource = selectedSource,
          )
        } else {
          UpdateUiState(updateSource = selectedSource)
        }
      }
  }

  fun dismiss() { mutableState.value = UpdateUiState(updateSource = mutableState.value.updateSource) }

  fun selectUpdateSource(source: UpdateSource) {
    repository.setUpdateSource(source)
    mutableState.value = mutableState.value.copy(updateSource = source)
  }

  fun ignore() {
    val release = mutableState.value.release ?: return
    repository.ignore(release)
    mutableState.value = UpdateUiState(updateSource = mutableState.value.updateSource)
  }

  fun download() {
    val release = mutableState.value.release ?: return
    viewModelScope.launch {
      mutableState.value = mutableState.value.copy(downloading = true, updateStage = UpdateStage.DOWNLOADING, downloadProgress = 0f, error = null)
      runCatching {
        installer.downloadVerifyAndInstall(release, mutableState.value.updateSource) { stage, progress ->
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
