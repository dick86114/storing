package com.idickies.storing.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.idickies.storing.auth.AuthViewModel
import com.idickies.storing.auth.LoginCredentials
import com.idickies.storing.collect.ShareCollectViewModel

@Composable
fun QiankunjieApp(
  sharedText: String?,
  onSharedTextConsumed: () -> Unit,
  authViewModel: AuthViewModel = hiltViewModel(),
) {
  val state by authViewModel.state.collectAsState()
  val user = state.user
  when {
    state.checkingSession -> LoadingScreen()
    user == null -> LoginScreen(
      submitting = state.submitting,
      errorMessage = state.errorMessage,
      onLogin = authViewModel::login,
    )
    else -> HomeSkeleton(
      username = user.username,
      sharedText = sharedText,
      onSharedTextConsumed = onSharedTextConsumed,
      onLogout = authViewModel::logout,
    )
  }
}

@Composable
private fun LoadingScreen() {
  Column(
    modifier = Modifier.fillMaxSize(),
    verticalArrangement = Arrangement.Center,
    horizontalAlignment = Alignment.CenterHorizontally,
  ) {
    CircularProgressIndicator()
    Spacer(Modifier.height(16.dp))
    Text("正在恢复会话…")
  }
}

@Composable
private fun LoginScreen(
  submitting: Boolean,
  errorMessage: String?,
  onLogin: (LoginCredentials) -> Unit,
) {
  var username by rememberSaveable { mutableStateOf("") }
  var password by rememberSaveable { mutableStateOf("") }
  val credentials = LoginCredentials(username, password)

  Column(
    modifier = Modifier.fillMaxSize().padding(28.dp),
    verticalArrangement = Arrangement.Center,
  ) {
    Text("乾坤戒", style = MaterialTheme.typography.displaySmall)
    Text("把值得阅读的内容，藏进你的知识空间。", color = MaterialTheme.colorScheme.onSurfaceVariant)
    Spacer(Modifier.height(32.dp))
    OutlinedTextField(value = username, onValueChange = { username = it }, modifier = Modifier.fillMaxWidth(), enabled = !submitting, label = { Text("用户名") }, singleLine = true)
    Spacer(Modifier.height(12.dp))
    OutlinedTextField(value = password, onValueChange = { password = it }, modifier = Modifier.fillMaxWidth(), enabled = !submitting, label = { Text("密码") }, visualTransformation = PasswordVisualTransformation(), singleLine = true)
    if (errorMessage != null) Text(text = errorMessage, modifier = Modifier.padding(top = 12.dp), color = MaterialTheme.colorScheme.error)
    Spacer(Modifier.height(20.dp))
    Button(onClick = { onLogin(credentials) }, modifier = Modifier.fillMaxWidth(), enabled = credentials.isSubmittable && !submitting) {
      Text(if (submitting) "登录中…" else "登录")
    }
  }
}

@Composable
private fun HomeSkeleton(
  @Suppress("UNUSED_PARAMETER") username: String,
  sharedText: String?,
  onSharedTextConsumed: () -> Unit,
  onLogout: () -> Unit,
) {
  LibraryScreen(
    sharedText = sharedText,
    onSharedTextConsumed = onSharedTextConsumed,
    onLogout = onLogout,
  )
}
