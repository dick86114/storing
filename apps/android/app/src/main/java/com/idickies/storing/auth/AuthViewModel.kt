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
        .onFailure { error -> mutableState.update { it.copy(submitting = false, errorMessage = error.message ?: "登录失败，请稍后重试") } }
    }
  }

  fun logout() {
    viewModelScope.launch {
      authRepository.logout()
      mutableState.value = AuthUiState(checkingSession = false)
    }
  }
}
