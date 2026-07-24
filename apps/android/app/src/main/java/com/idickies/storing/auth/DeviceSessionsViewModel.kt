package com.idickies.storing.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.idickies.storing.network.MobileSessionInfo
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class DeviceSessionsUiState(
  val currentDeviceId: String = "",
  val sessions: List<MobileSessionInfo> = emptyList(),
  val loading: Boolean = true,
  val refreshing: Boolean = false,
  val revokingSessionId: String? = null,
  val error: String? = null,
)

@HiltViewModel
class DeviceSessionsViewModel @Inject constructor(
  private val authRepository: AuthRepository,
  deviceIdentityProvider: DeviceIdentityProvider,
) : ViewModel() {
  private val mutableState = MutableStateFlow(DeviceSessionsUiState(currentDeviceId = deviceIdentityProvider.current().deviceId))
  val state = mutableState.asStateFlow()

  init { load() }

  fun refresh() = load(refreshing = true)

  fun revoke(session: MobileSessionInfo) {
    val snapshot = mutableState.value
    if (!session.canRevokeFromDeviceManager(snapshot.currentDeviceId) || snapshot.revokingSessionId != null) return
    viewModelScope.launch {
      mutableState.update { it.copy(revokingSessionId = session.id, error = null) }
      runCatching { authRepository.revokeSession(session.id) }
        .onSuccess { revoked ->
          mutableState.update {
            it.copy(
              sessions = if (revoked) it.sessions.filterNot { active -> active.id == session.id } else it.sessions,
              revokingSessionId = null,
              error = if (revoked) null else "设备会话已失效，请刷新后重试",
            )
          }
        }
        .onFailure { error ->
          mutableState.update { it.copy(revokingSessionId = null, error = error.message ?: "撤销设备会话失败") }
        }
    }
  }

  private fun load(refreshing: Boolean = false) {
    viewModelScope.launch {
      mutableState.update { it.copy(loading = !refreshing, refreshing = refreshing, error = null) }
      runCatching { authRepository.sessions() }
        .onSuccess { sessions ->
          mutableState.update { it.copy(sessions = sessions, loading = false, refreshing = false) }
        }
        .onFailure { error ->
          mutableState.update { it.copy(loading = false, refreshing = false, error = error.message ?: "加载设备会话失败") }
        }
    }
  }
}
