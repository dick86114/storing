package com.idickies.storing.ui

import android.app.Activity
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.isSystemInDarkTheme
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
import androidx.compose.foundation.Image
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Download
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.outlined.Sync
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.Visibility
import androidx.compose.material.icons.outlined.VisibilityOff
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Scaffold
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
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
import androidx.compose.runtime.DisposableEffect
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
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.idickies.storing.R
import com.idickies.storing.auth.AuthViewModel
import com.idickies.storing.auth.LoginCredentials
import com.idickies.storing.collect.ShareCollectViewModel
import com.idickies.storing.update.AndroidReleaseUpdatePolicy
import com.idickies.storing.update.UpdateViewModel
import com.idickies.storing.reader.ReaderColorScheme
import com.idickies.storing.ui.theme.AppearanceViewModel
import com.idickies.storing.ui.theme.QiankunjieTheme
import com.idickies.storing.security.BiometricLockScreen
import com.idickies.storing.security.BiometricManager
import com.idickies.storing.security.SecurityViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import androidx.lifecycle.compose.LocalLifecycleOwner

@Composable
fun QiankunjieApp(
  sharedText: String?,
  onSharedTextConsumed: () -> Unit,
  openArticleId: Int?,
  onArticleOpened: () -> Unit,
  openPublicId: String? = null,
  onPublicIdOpened: () -> Unit = {},
  openCollectJobs: Boolean,
  onCollectJobsOpened: () -> Unit,
  openMcpSettings: Boolean = false,
  onMcpSettingsOpened: () -> Unit = {},
  authViewModel: AuthViewModel = hiltViewModel(),
  updateViewModel: UpdateViewModel = hiltViewModel(),
  appearanceViewModel: AppearanceViewModel = hiltViewModel(),
  securityViewModel: SecurityViewModel = hiltViewModel(),
  floatingCollectViewModel: FloatingCollectViewModel = hiltViewModel(),
) {
  val state by authViewModel.state.collectAsState()
  val updateState by updateViewModel.state.collectAsState()
  val themeMode by appearanceViewModel.themeMode.collectAsState()
  val systemDark = isSystemInDarkTheme()
  val user = state.user
  val biometricEnabled by securityViewModel.biometricEnabled.collectAsState()
  val biometricLocked by securityViewModel.locked.collectAsState()
  val floatingCollectEnabled by floatingCollectViewModel.enabled.collectAsState()
  val lifecycleOwner = LocalLifecycleOwner.current
  val context = LocalContext.current
  DisposableEffect(lifecycleOwner) {
    val observer = LifecycleEventObserver { _, event ->
      when (event) {
        Lifecycle.Event.ON_PAUSE -> securityViewModel.onAppBackgrounded()
        Lifecycle.Event.ON_RESUME -> securityViewModel.onAppResumed()
        else -> {}
      }
    }
    lifecycleOwner.lifecycle.addObserver(observer)
    onDispose { lifecycleOwner.lifecycle.removeObserver(observer) }
  }
  var showLogin by rememberSaveable { mutableStateOf(false) }
  LaunchedEffect(user?.id) {
    if (user != null) {
      showLogin = false
      updateViewModel.checkOnLaunch()
    }
  }
  QiankunjieTheme(darkTheme = themeMode.resolve(systemDark)) {
  if (biometricLocked && user != null) {
    BiometricLockScreen(
      onUnlocked = securityViewModel::unlock,
      onLogout = authViewModel::logout,
    )
    return@QiankunjieTheme
  }
  when {
    state.checkingSession -> LoadingScreen()
    user == null && showLogin -> {
      BackHandler { showLogin = false }
      LoginScreen(
        submitting = state.submitting,
        errorMessage = state.errorMessage,
        onLogin = authViewModel::login,
        onBack = { showLogin = false },
      )
    }
    else -> HomeSkeleton(
      username = user?.username,
      sharedText = sharedText,
      onSharedTextConsumed = onSharedTextConsumed,
      openArticleId = openArticleId,
      onArticleOpened = onArticleOpened,
      openPublicId = openPublicId,
      onPublicIdOpened = onPublicIdOpened,
      openCollectJobs = openCollectJobs,
      openMcpSettings = openMcpSettings,
      onMcpSettingsOpened = onMcpSettingsOpened,
      onCollectJobsOpened = onCollectJobsOpened,
      onManualUpdateCheck = updateViewModel::checkNow,
      updateChecking = updateState.checking,
      themeMode = themeMode,
      onThemeModeChange = appearanceViewModel::selectThemeMode,
      isAuthenticated = user != null,
      isAdmin = user?.role == "admin",
      biometricAvailable = BiometricManager.canAuthenticate(context),
      biometricEnabled = biometricEnabled,
      onBiometricEnabledChange = securityViewModel::setBiometricEnabled,
      floatingCollectEnabled = floatingCollectEnabled,
      onFloatingCollectEnabledChange = floatingCollectViewModel::setEnabled,
      readerColorScheme = if (themeMode.resolve(systemDark)) ReaderColorScheme.Dark else ReaderColorScheme.Light,
      onRequestLogin = { showLogin = true },
      onLogout = authViewModel::logout,
    )
  }
  updateState.statusMessage?.let { message ->
    AlertDialog(
      onDismissRequest = updateViewModel::dismiss,
      icon = { Icon(Icons.Outlined.CheckCircle, contentDescription = null, tint = MaterialTheme.colorScheme.primary) },
      title = { Text("已检查更新") },
      text = { Text(message, color = MaterialTheme.colorScheme.onSurfaceVariant) },
      confirmButton = { Button(onClick = updateViewModel::dismiss) { Text("知道了") } },
    )
  }
  updateState.error?.takeIf { updateState.release == null }?.let { message ->
    AlertDialog(
      onDismissRequest = updateViewModel::dismiss,
      icon = { Icon(Icons.Outlined.ErrorOutline, contentDescription = null, tint = MaterialTheme.colorScheme.error) },
      title = { Text("暂时无法检查更新") },
      text = { Text(message, color = MaterialTheme.colorScheme.onSurfaceVariant) },
      confirmButton = { Button(onClick = updateViewModel::dismiss) { Text("关闭") } },
    )
  }
  updateState.release?.let { release ->
    val mandatory = AndroidReleaseUpdatePolicy.isMandatory(com.idickies.storing.BuildConfig.VERSION_CODE, release)
    AlertDialog(
      onDismissRequest = { if (!mandatory && !updateState.downloading) updateViewModel.dismiss() },
      icon = { Icon(Icons.Outlined.Sync, contentDescription = null, tint = MaterialTheme.colorScheme.primary) },
      title = { Text(if (mandatory) "需要更新乾坤戒" else "发现新版本") },
      text = {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
          Surface(color = MaterialTheme.colorScheme.primaryContainer, shape = RoundedCornerShape(16.dp)) {
            Column(Modifier.padding(14.dp)) {
              Text("乾坤戒 ${release.versionName}", style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.onPrimaryContainer)
              Text(if (mandatory) "此版本需要安装后才能继续使用。" else "新版本已经准备好，可随时下载并安装。", color = MaterialTheme.colorScheme.onPrimaryContainer, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 4.dp))
            }
          }
          Text(release.releaseNotes.ifEmpty { listOf("此版本包含体验改进。") }.joinToString("\n"), color = MaterialTheme.colorScheme.onSurfaceVariant)
          updateState.error?.let { Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium) }
        }
      },
      confirmButton = { Button(onClick = updateViewModel::download, enabled = !updateState.downloading) { Icon(Icons.Outlined.Download, contentDescription = null, modifier = Modifier.size(18.dp)); Spacer(Modifier.size(7.dp)); Text(if (updateState.downloading) "下载并校验中…" else "下载更新") } },
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
@OptIn(ExperimentalMaterial3Api::class)
internal fun LoginScreen(
  submitting: Boolean,
  errorMessage: String?,
  onLogin: (LoginCredentials) -> Unit,
  onBack: () -> Unit = {},
) {
  var username by rememberSaveable { mutableStateOf("") }
  var password by rememberSaveable { mutableStateOf("") }
  var passwordVisible by rememberSaveable { mutableStateOf(false) }
  val credentials = LoginCredentials(username, password)

  Scaffold(
    topBar = {
      TopAppBar(
        title = { Text("登录") },
        navigationIcon = {
          androidx.compose.material3.IconButton(onClick = onBack) {
            Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "返回")
          }
        },
        colors = TopAppBarDefaults.topAppBarColors(containerColor = Color.Transparent),
      )
    },
  ) { padding ->
  Column(
    modifier = Modifier.fillMaxSize().padding(padding).padding(horizontal = 28.dp, vertical = 16.dp),
    verticalArrangement = Arrangement.Center,
  ) {
    Surface(
      color = Color.Transparent,
      shape = RoundedCornerShape(30.dp),
      modifier = Modifier.size(88.dp).clip(RoundedCornerShape(30.dp)).background(
        Brush.linearGradient(listOf(MaterialTheme.colorScheme.primary, MaterialTheme.colorScheme.secondary)),
      ),
    ) {
      androidx.compose.foundation.layout.Box(contentAlignment = Alignment.Center) {
        Image(painter = painterResource(R.drawable.brand_logo), contentDescription = "乾坤戒产品标志", modifier = Modifier.size(46.dp))
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
      shape = MaterialTheme.shapes.medium,
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
      keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
      keyboardActions = KeyboardActions(onDone = { if (credentials.isSubmittable && !submitting) onLogin(credentials) }),
      shape = MaterialTheme.shapes.medium,
      singleLine = true,
    )
    errorMessage?.let { message ->
      Row(modifier = Modifier.padding(top = 14.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(Icons.Outlined.Lock, contentDescription = null, tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(18.dp))
        Text(text = message, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium)
      }
    }
    Spacer(Modifier.height(22.dp))
    Button(onClick = { onLogin(credentials) }, modifier = Modifier.fillMaxWidth(), enabled = credentials.isSubmittable && !submitting, shape = MaterialTheme.shapes.medium) {
      if (submitting) {
        CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp, color = MaterialTheme.colorScheme.onPrimary)
        Spacer(Modifier.size(10.dp))
      }
      Text(if (submitting) "正在登录…" else "进入乾坤戒")
    }
  }
  }
}

@Composable
private fun HomeSkeleton(
  @Suppress("UNUSED_PARAMETER") username: String?,
  sharedText: String?,
  onSharedTextConsumed: () -> Unit,
  openArticleId: Int?,
  onArticleOpened: () -> Unit,
  openPublicId: String? = null,
  onPublicIdOpened: () -> Unit = {},
  openCollectJobs: Boolean,
  onCollectJobsOpened: () -> Unit,
  openMcpSettings: Boolean = false,
  onMcpSettingsOpened: () -> Unit = {},
  onManualUpdateCheck: () -> Unit,
  updateChecking: Boolean,
  themeMode: com.idickies.storing.ui.theme.ThemeMode,
  onThemeModeChange: (com.idickies.storing.ui.theme.ThemeMode) -> Unit,
  isAuthenticated: Boolean,
  isAdmin: Boolean,
  biometricAvailable: Boolean,
  biometricEnabled: Boolean,
  onBiometricEnabledChange: (Boolean) -> Unit,
  floatingCollectEnabled: Boolean,
  onFloatingCollectEnabledChange: (Boolean) -> Unit,
  readerColorScheme: ReaderColorScheme,
  onRequestLogin: () -> Unit,
  onLogout: () -> Unit,
) {
  val context = LocalContext.current
  var confirmExit by rememberSaveable { mutableStateOf(false) }
  BackHandler {
    if (ExitConfirmationPolicy.requiresConfirmation(isRootScreen = true)) confirmExit = true
  }
  LibraryScreen(
    sharedText = sharedText,
    onSharedTextConsumed = onSharedTextConsumed,
    openArticleId = openArticleId,
    onArticleOpened = onArticleOpened,
    openPublicId = openPublicId,
    onPublicIdOpened = onPublicIdOpened,
    openCollectJobs = openCollectJobs,
    onCollectJobsOpened = onCollectJobsOpened,
    onManualUpdateCheck = onManualUpdateCheck,
    updateChecking = updateChecking,
    themeMode = themeMode,
    onThemeModeChange = onThemeModeChange,
    isAuthenticated = isAuthenticated,
    isAdmin = isAdmin,
    biometricAvailable = biometricAvailable,
    biometricEnabled = biometricEnabled,
    onBiometricEnabledChange = onBiometricEnabledChange,
    floatingCollectEnabled = floatingCollectEnabled,
    onFloatingCollectEnabledChange = onFloatingCollectEnabledChange,
    readerColorScheme = readerColorScheme,
    onRequestLogin = onRequestLogin,
    onLogout = onLogout,
  )
  if (confirmExit) {
    AlertDialog(
      onDismissRequest = { confirmExit = false },
      icon = { Icon(Icons.Outlined.ErrorOutline, contentDescription = null, tint = MaterialTheme.colorScheme.primary) },
      title = { Text("退出乾坤戒？") },
      text = { Text("再次确认后将退出应用。") },
      confirmButton = { Button(onClick = { (context as? Activity)?.finish(); confirmExit = false }) { Text("确认退出") } },
      dismissButton = { TextButton(onClick = { confirmExit = false }) { Text("继续阅读") } },
    )
  }
}
