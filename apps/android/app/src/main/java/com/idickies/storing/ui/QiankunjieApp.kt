package com.idickies.storing.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AutoStories
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.Visibility
import androidx.compose.material.icons.outlined.VisibilityOff
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
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
  var passwordVisible by rememberSaveable { mutableStateOf(false) }
  val credentials = LoginCredentials(username, password)

  Column(
    modifier = Modifier.fillMaxSize().padding(horizontal = 28.dp, vertical = 32.dp),
    verticalArrangement = Arrangement.Center,
  ) {
    Surface(
      color = Color.Transparent,
      shape = RoundedCornerShape(30.dp),
      modifier = Modifier.size(88.dp).clip(RoundedCornerShape(30.dp)).background(
        Brush.linearGradient(listOf(MaterialTheme.colorScheme.primary, MaterialTheme.colorScheme.tertiary)),
      ),
    ) {
      androidx.compose.foundation.layout.Box(contentAlignment = Alignment.Center) {
        Icon(Icons.Outlined.AutoStories, contentDescription = null, tint = MaterialTheme.colorScheme.onPrimary, modifier = Modifier.size(42.dp))
      }
    }
    Spacer(Modifier.height(24.dp))
    Text("乾坤戒", style = MaterialTheme.typography.displaySmall)
    Text("把值得阅读的内容，藏进你的知识空间。", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyLarge, modifier = Modifier.padding(top = 8.dp))
    Spacer(Modifier.height(36.dp))
    OutlinedTextField(
      value = username,
      onValueChange = { username = it },
      modifier = Modifier.fillMaxWidth(),
      enabled = !submitting,
      label = { Text("用户名") },
      leadingIcon = { Icon(Icons.Outlined.Person, contentDescription = null) },
      singleLine = true,
    )
    Spacer(Modifier.height(12.dp))
    OutlinedTextField(
      value = password,
      onValueChange = { password = it },
      modifier = Modifier.fillMaxWidth(),
      enabled = !submitting,
      label = { Text("密码") },
      leadingIcon = { Icon(Icons.Outlined.Lock, contentDescription = null) },
      trailingIcon = {
        IconButton(onClick = { passwordVisible = !passwordVisible }) {
          Icon(
            if (passwordVisible) Icons.Outlined.VisibilityOff else Icons.Outlined.Visibility,
            contentDescription = if (passwordVisible) "隐藏密码" else "显示密码",
          )
        }
      },
      visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
      singleLine = true,
    )
    errorMessage?.let { message ->
      Row(modifier = Modifier.padding(top = 14.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(Icons.Outlined.Lock, contentDescription = null, tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(18.dp))
        Text(text = message, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium)
      }
    }
    Spacer(Modifier.height(22.dp))
    Button(onClick = { onLogin(credentials) }, modifier = Modifier.fillMaxWidth(), enabled = credentials.isSubmittable && !submitting) {
      if (submitting) {
        CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp, color = MaterialTheme.colorScheme.onPrimary)
        Spacer(Modifier.size(10.dp))
      }
      Text(if (submitting) "正在登录…" else "进入乾坤戒")
    }
    Text("使用你的乾坤戒账号登录。服务地址由应用固定管理。", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 16.dp))
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
