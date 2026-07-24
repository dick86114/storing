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
  private val api: AdminApi,
) : ViewModel() {
  private val mutableState = MutableStateFlow(AdminUiState())
  val state = mutableState.asStateFlow()

  init { load() }

  fun load() {
    viewModelScope.launch {
      mutableState.update { it.copy(loading = true, error = null, forbidden = false) }
      runCatching {
        val users = api.users().users
        val logs = api.auditLogs().logs
        val mcpClients = api.mcpClients().clients
        val mcpLogs = api.mcpRequestLogs().logs
        val mcpLimits = api.mcpDefaultLimits()
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
      runCatching { api.createUser(AdminCreateUserRequest(username = username, password = password, role = role)) }
        .onSuccess { response ->
          mutableState.update { it.copy(submitting = false, users = listOf(response.user) + it.users) }
        }
        .onFailure { error -> mutableState.update { it.copy(submitting = false, error = error.message ?: "创建失败") } }
    }
  }

  fun updateUser(id: Int, username: String?, role: String?, status: String?, password: String?) {
    if (mutableState.value.submitting) return
    viewModelScope.launch {
      mutableState.update { it.copy(submitting = true, error = null) }
      runCatching { api.updateUser(id, AdminUpdateUserRequest(username = username, role = role, status = status, password = password)) }
        .onSuccess { response ->
          mutableState.update { state ->
            state.copy(submitting = false, users = state.users.map { if (it.id == id) response.user else it })
          }
          load()
        }
        .onFailure { error -> mutableState.update { it.copy(submitting = false, error = error.message ?: "更新失败") } }
    }
  }

  fun updateMcpLimits(perMinute: Int, perDay: Int, concurrent: Int) {
    if (mutableState.value.submitting) return
    viewModelScope.launch {
      mutableState.update { it.copy(submitting = true, error = null) }
      runCatching { api.updateMcpDefaultLimits(AdminMcpUpdateLimitsRequest(perMinute, perDay, concurrent)) }
        .onSuccess { limits -> mutableState.update { it.copy(submitting = false, mcpLimits = limits) } }
        .onFailure { error -> mutableState.update { it.copy(submitting = false, error = error.message ?: "更新失败") } }
    }
  }

  fun clearError() = mutableState.update { it.copy(error = null) }
}
