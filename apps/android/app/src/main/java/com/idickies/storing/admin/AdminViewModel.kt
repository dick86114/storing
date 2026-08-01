package com.idickies.storing.admin

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class AdminUiState(
  val loading: Boolean = true,
  val error: String? = null,
  val notice: String? = null,
  val users: List<AdminUser> = emptyList(),
  val auditLogs: List<AdminAuditLog> = emptyList(),
  val mcpClients: List<AdminMcpClient> = emptyList(),
  val mcpLogs: List<AdminMcpRequestLog> = emptyList(),
  val mcpLimits: AdminMcpPlatformLimits? = null,
  val submitting: Boolean = false,
  val forbidden: Boolean = false,
)

@HiltViewModel
class AdminViewModel @Inject constructor(
  private val repository: AdminRepository,
) : ViewModel() {
  private val mutableState = MutableStateFlow(AdminUiState())
  val state = mutableState.asStateFlow()

  init { load() }

  fun load() {
    viewModelScope.launch {
      mutableState.update { it.copy(loading = true, error = null, forbidden = false) }
      runCatching {
        val users = repository.users()
        val logs = repository.auditLogs()
        val mcpClients = repository.mcpClients()
        val mcpLogs = repository.mcpRequestLogs()
        val mcpLimits = repository.mcpDefaultLimits()
        mutableState.update { it.copy(loading = false, users = users, auditLogs = logs, mcpClients = mcpClients, mcpLogs = mcpLogs, mcpLimits = mcpLimits) }
      }.onFailure { error ->
        val message = error.message ?: "加载失败"
        val isForbidden = message.contains("403") || message.contains("FORBIDDEN")
        mutableState.update { it.copy(loading = false, error = message, forbidden = isForbidden) }
      }
    }
  }

  fun createUser(username: String, password: String, role: String) {
    if (mutableState.value.submitting) return
    viewModelScope.launch {
      mutableState.update { it.copy(submitting = true, error = null) }
      runCatching { repository.createUser(AdminCreateUserRequest(username = username, password = password, role = role)) }
        .onSuccess { response ->
          mutableState.update { it.copy(submitting = false, users = listOf(response) + it.users) }
        }
        .onFailure { error -> mutableState.update { it.copy(submitting = false, error = error.message ?: "创建失败") } }
    }
  }

  fun updateUser(id: Int, username: String?, role: String?, status: String?, password: String?) {
    if (mutableState.value.submitting) return
    viewModelScope.launch {
      mutableState.update { it.copy(submitting = true, error = null) }
      runCatching { repository.updateUser(id, AdminUpdateUserRequest(username = username, role = role, status = status, password = password)) }
        .onSuccess { response ->
          mutableState.update { state ->
            state.copy(submitting = false, users = state.users.map { if (it.id == id) response else it })
          }
          load()
        }
        .onFailure { error -> mutableState.update { it.copy(submitting = false, error = error.message ?: "更新失败") } }
    }
  }

  fun deleteUser(id: Int) {
    if (mutableState.value.submitting) return
    viewModelScope.launch {
      mutableState.update { it.copy(submitting = true, error = null, notice = null) }
      runCatching { repository.deleteUser(id) }
        .onSuccess { response ->
          mutableState.update { state -> adminUserDeletionSucceeded(state, response) }
          load()
        }
        .onFailure { error ->
          mutableState.update { state -> adminUserDeletionFailed(state, error) }
        }
    }
  }

  fun updateMcpLimits(perMinute: Int, perDay: Int, concurrent: Int) {
    if (mutableState.value.submitting) return
    viewModelScope.launch {
      mutableState.update { it.copy(submitting = true, error = null) }
      runCatching { repository.updateMcpDefaultLimits(AdminMcpUpdateLimitsRequest(perMinute, perDay, concurrent)) }
        .onSuccess { limits -> mutableState.update { it.copy(submitting = false, mcpLimits = limits) } }
        .onFailure { error -> mutableState.update { it.copy(submitting = false, error = error.message ?: "更新失败") } }
    }
  }

  fun clearError() = mutableState.update { it.copy(error = null) }

  fun clearNotice() = mutableState.update { it.copy(notice = null) }
}

internal fun adminUserDeletionSucceeded(
  state: AdminUiState,
  response: AdminDeleteUserResponse,
): AdminUiState = state.copy(
  submitting = false,
  users = state.users.filterNot { it.id == response.userId },
  notice = "已永久删除用户「${response.username}」",
)

internal fun adminUserDeletionFailed(
  state: AdminUiState,
  error: Throwable,
): AdminUiState = state.copy(
  submitting = false,
  error = error.message ?: "删除用户失败",
)
