package com.idickies.storing.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.idickies.storing.network.MobileUser
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class AuthUiState(
  val checkingSession: Boolean = true,
  val user: MobileUser? = null,
  val submitting: Boolean = false,
  val errorMessage: String? = null,
)

@HiltViewModel
class AuthViewModel @Inject constructor(
  private val authRepository: AuthRepository,
) : ViewModel() {
  private val mutableState = MutableStateFlow(AuthUiState())
  val state = mutableState.asStateFlow()

  init {
    viewModelScope.launch {
      val user = authRepository.restoreSession()
      mutableState.update { it.copy(checkingSession = false, user = user) }
    }
  }

  fun login(credentials: LoginCredentials) {
    if (!credentials.isSubmittable || mutableState.value.submitting) return
    viewModelScope.launch {
      mutableState.update { it.copy(submitting = true, errorMessage = null) }
      runCatching { authRepository.login(credentials.normalizedUsername, credentials.password) }
        .onSuccess { user -> mutableState.update { it.copy(submitting = false, user = user) } }
        .onFailure { error -> mutableState.update { it.copy(submitting = false, errorMessage = friendlyLoginError(error.message)) } }
    }
  }

  private fun friendlyLoginError(raw: String?): String {
    val msg = raw.orEmpty()
    return when {
      msg.contains("401", ignoreCase = true) || msg.contains("UNAUTHORIZED", ignoreCase = true) -> "用户名或密码不正确"
      msg.contains("403", ignoreCase = true) || msg.contains("FORBIDDEN", ignoreCase = true) -> "账号已被禁用，请联系管理员"
      msg.contains("429", ignoreCase = true) || msg.contains("RATE", ignoreCase = true) -> "尝试过于频繁，请稍后再试"
      msg.contains("Unable to resolve host", ignoreCase = true) || msg.contains("network", ignoreCase = true) -> "网络连接失败，请检查网络后重试"
      msg.contains("timeout", ignoreCase = true) || msg.contains("timed out", ignoreCase = true) -> "连接超时，请稍后重试"
      msg.contains("500", ignoreCase = true) || msg.contains("502", ignoreCase = true) || msg.contains("503", ignoreCase = true) -> "服务器暂时不可用，请稍后重试"
      else -> "登录失败，请稍后重试"
    }
  }

  fun logout() {
    viewModelScope.launch {
      authRepository.logout()
      mutableState.value = AuthUiState(checkingSession = false)
    }
  }
}
