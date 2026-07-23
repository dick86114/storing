package com.idickies.storing.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
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
import com.idickies.storing.update.AndroidReleaseUpdatePolicy
import com.idickies.storing.update.UpdateViewModel

@Composable
fun QiankunjieApp(
  sharedText: String?,
  onSharedTextConsumed: () -> Unit,
  openArticleId: Int?,
  onArticleOpened: () -> Unit,
  openCollectJobs: Boolean,
  onCollectJobsOpened: () -> Unit,
  authViewModel: AuthViewModel = hiltViewModel(),
  updateViewModel: UpdateViewModel = hiltViewModel(),
) {
  val state by authViewModel.state.collectAsState()
  val updateState by updateViewModel.state.collectAsState()
  val user = state.user
  LaunchedEffect(user?.id) { if (user != null) updateViewModel.checkOnLaunch() }
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
      openArticleId = openArticleId,
      onArticleOpened = onArticleOpened,
      openCollectJobs = openCollectJobs,
      onCollectJobsOpened = onCollectJobsOpened,
      onManualUpdateCheck = updateViewModel::checkNow,
      updateChecking = updateState.checking,
      onLogout = authViewModel::logout,
    )
  }
  updateState.statusMessage?.let { message ->
    AlertDialog(
      onDismissRequest = updateViewModel::dismiss,
      title = { Text("检查更新") },
      text = { Text(message) },
      confirmButton = { Button(onClick = updateViewModel::dismiss) { Text("知道了") } },
    )
  }
  updateState.error?.takeIf { updateState.release == null }?.let { message ->
    AlertDialog(
      onDismissRequest = updateViewModel::dismiss,
      title = { Text("检查更新") },
      text = { Text(message) },
      confirmButton = { Button(onClick = updateViewModel::dismiss) { Text("关闭") } },
    )
  }
  updateState.release?.let { release ->
    val mandatory = AndroidReleaseUpdatePolicy.isMandatory(com.idickies.storing.BuildConfig.VERSION_CODE, release)
    AlertDialog(
      onDismissRequest = { if (!mandatory && !updateState.downloading) updateViewModel.dismiss() },
      title = { Text(if (mandatory) "需要更新乾坤戒" else "发现新版本 ${release.versionName}") },
      text = {
        Column {
          Text(release.releaseNotes.ifEmpty { listOf("此版本包含体验改进。") }.joinToString("\n"))
          updateState.error?.let { Text(it, modifier = Modifier.padding(top = 12.dp), color = MaterialTheme.colorScheme.error) }
        }
      },
      confirmButton = { Button(onClick = updateViewModel::download, enabled = !updateState.downloading) { Text(if (updateState.downloading) "下载并校验中…" else "下载更新") } },
      dismissButton = if (!mandatory) {
        {
          Row {
            TextButton(onClick = updateViewModel::ignore, enabled = !updateState.downloading) { Text("忽略此版本") }
            OutlinedButton(onClick = updateViewModel::dismiss, enabled = !updateState.downloading, modifier = Modifier.padding(start = 8.dp)) { Text("暂不更新") }
          }
        }
      } else null,
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
  openArticleId: Int?,
  onArticleOpened: () -> Unit,
  openCollectJobs: Boolean,
  onCollectJobsOpened: () -> Unit,
  onManualUpdateCheck: () -> Unit,
  updateChecking: Boolean,
  onLogout: () -> Unit,
) {
  LibraryScreen(
    sharedText = sharedText,
    onSharedTextConsumed = onSharedTextConsumed,
    openArticleId = openArticleId,
    onArticleOpened = onArticleOpened,
    openCollectJobs = openCollectJobs,
    onCollectJobsOpened = onCollectJobsOpened,
    onManualUpdateCheck = onManualUpdateCheck,
    updateChecking = updateChecking,
    onLogout = onLogout,
  )
}
