package com.idickies.storing.mcp

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class McpUiState(
  val loading: Boolean = true,
  val limits: McpPlatformLimits? = null,
  val clients: List<McpClient> = emptyList(),
  val logs: List<McpRequestLog> = emptyList(),
  val error: String? = null,
  val newlyCreatedApiKey: String? = null,
  val newlyRotatedApiKey: String? = null,
  val pendingClientId: Int? = null,
  val submitting: Boolean = false,
)

@HiltViewModel
class McpViewModel @Inject constructor(
  private val api: McpApi,
) : ViewModel() {
  private val mutableState = MutableStateFlow(McpUiState())
  val state = mutableState.asStateFlow()

  init { load() }

  fun load() {
    viewModelScope.launch {
      mutableState.update { it.copy(loading = true, error = null) }
      runCatching {
        val limits = api.limits()
        val clients = api.clients().clients
        val logs = api.requestLogs().logs
        mutableState.update { it.copy(loading = false, limits = limits, clients = clients, logs = logs) }
      }.onFailure { error ->
        mutableState.update { it.copy(loading = false, error = error.message ?: "加载失败") }
      }
    }
  }

  fun createClient(name: String, scopes: List<String>, defaultSaveToInbox: Boolean) {
    if (mutableState.value.submitting) return
    viewModelScope.launch {
      mutableState.update { it.copy(submitting = true, error = null) }
      runCatching {
        api.createClient(McpCreateClientRequest(name = name, scopes = scopes, defaultSaveToInbox = defaultSaveToInbox))
      }.onSuccess { response ->
        mutableState.update {
          it.copy(
            submitting = false,
            clients = listOf(response.client) + it.clients,
            newlyCreatedApiKey = response.apiKey,
          )
        }
      }.onFailure { error ->
        mutableState.update { it.copy(submitting = false, error = error.message ?: "创建失败") }
      }
    }
  }

  fun toggleEnabled(client: McpClient) {
    viewModelScope.launch {
      runCatching { api.updateClient(client.id, McpUpdateClientRequest(enabled = !client.enabled)) }
        .onSuccess { response ->
          mutableState.update { state ->
            state.copy(clients = state.clients.map { if (it.id == client.id) response.client else it })
          }
        }
        .onFailure { error -> mutableState.update { it.copy(error = error.message ?: "操作失败") } }
    }
  }

  fun updateScopes(client: McpClient, scopes: List<String>) {
    viewModelScope.launch {
      runCatching { api.updateClient(client.id, McpUpdateClientRequest(scopes = scopes)) }
        .onSuccess { response ->
          mutableState.update { state ->
            state.copy(clients = state.clients.map { if (it.id == client.id) response.client else it })
          }
        }
        .onFailure { error -> mutableState.update { it.copy(error = error.message ?: "操作失败") } }
    }
  }

  fun toggleSaveToInbox(client: McpClient) {
    viewModelScope.launch {
      runCatching { api.updateClient(client.id, McpUpdateClientRequest(defaultSaveToInbox = !client.defaultSaveToInbox)) }
        .onSuccess { response ->
          mutableState.update { state ->
            state.copy(clients = state.clients.map { if (it.id == client.id) response.client else it })
          }
        }
        .onFailure { error -> mutableState.update { it.copy(error = error.message ?: "操作失败") } }
    }
  }

  fun rotateKey(clientId: Int) {
    if (mutableState.value.submitting) return
    viewModelScope.launch {
      mutableState.update { it.copy(submitting = true, pendingClientId = clientId, error = null) }
      runCatching { api.rotateKey(clientId) }
        .onSuccess { response ->
          mutableState.update { state ->
            state.copy(
              submitting = false,
              pendingClientId = null,
              clients = state.clients.map { if (it.id == clientId) response.client else it },
              newlyRotatedApiKey = response.apiKey,
            )
          }
        }
        .onFailure { error ->
          mutableState.update { it.copy(submitting = false, pendingClientId = null, error = error.message ?: "轮换失败") }
        }
    }
  }

  fun deleteClient(clientId: Int) {
    viewModelScope.launch {
      runCatching { api.deleteClient(clientId) }
        .onSuccess { mutableState.update { state -> state.copy(clients = state.clients.filterNot { it.id == clientId }) } }
        .onFailure { error -> mutableState.update { it.copy(error = error.message ?: "删除失败") } }
    }
  }

  fun clearApiKey() = mutableState.update { it.copy(newlyCreatedApiKey = null, newlyRotatedApiKey = null) }
  fun clearError() = mutableState.update { it.copy(error = null) }
}
