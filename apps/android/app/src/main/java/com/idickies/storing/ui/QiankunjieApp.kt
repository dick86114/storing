package com.idickies.storing.ui

import android.app.Activity
import android.os.SystemClock
import android.widget.Toast
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
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
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.navigation.compose.hiltViewModel
import com.idickies.storing.BuildConfig
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
    QiankunjieAlertDialog(
      onDismissRequest = updateViewModel::dismiss,
      icon = { Icon(Icons.Outlined.CheckCircle, contentDescription = null, tint = MaterialTheme.colorScheme.primary) },
      title = { Text("已检查更新") },
      text = { Text(message, color = MaterialTheme.colorScheme.onSurfaceVariant) },
      confirmButton = { Button(onClick = updateViewModel::dismiss) { Text("知道了") } },
    )
  }
  updateState.error?.takeIf { updateState.release == null }?.let { message ->
    QiankunjieAlertDialog(
      onDismissRequest = updateViewModel::dismiss,
      icon = { Icon(Icons.Outlined.ErrorOutline, contentDescription = null, tint = MaterialTheme.colorScheme.error) },
      title = { Text("暂时无法检查更新") },
      text = { Text(message, color = MaterialTheme.colorScheme.onSurfaceVariant) },
      confirmButton = { Button(onClick = updateViewModel::dismiss) { Text("关闭") } },
    )
  }
  updateState.release?.let { release ->
    val mandatory = AndroidReleaseUpdatePolicy.isMandatory(com.idickies.storing.BuildConfig.VERSION_CODE, release)
    QiankunjieAlertDialog(
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

internal data class LoginPresentation(
  val brandMarkSize: androidx.compose.ui.unit.Dp,
  val inputHeight: androidx.compose.ui.unit.Dp,
  val submitHeight: androidx.compose.ui.unit.Dp,
  val cardRadius: androidx.compose.ui.unit.Dp,
  val englishName: String,
  val tagline: String,
  val helpText: String,
)

internal val loginPresentation = LoginPresentation(
  brandMarkSize = 56.dp,
  inputHeight = 56.dp,
  submitHeight = 52.dp,
  cardRadius = 16.dp,
  englishName = "Storing",
  tagline = "你的个人知识收藏空间",
  helpText = "账号由管理员创建，如需帮助请联系管理员",
)

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
  val colors = MaterialTheme.colorScheme
  val fieldColors = OutlinedTextFieldDefaults.colors(
    focusedBorderColor = colors.primary.copy(alpha = 0.68f),
    unfocusedBorderColor = colors.outline,
    disabledBorderColor = colors.outline.copy(alpha = 0.45f),
    focusedLeadingIconColor = colors.primary,
    unfocusedLeadingIconColor = colors.onSurfaceVariant,
    focusedTrailingIconColor = colors.primary,
    unfocusedTrailingIconColor = colors.onSurfaceVariant,
    cursorColor = colors.primary,
  )

  BackHandler(onBack = onBack)
  Box(
    modifier = Modifier
      .fillMaxSize()
      .background(colors.background)
      .windowInsetsPadding(WindowInsets.statusBars)
      .imePadding(),
  ) {
    Column(
      modifier = Modifier
        .fillMaxSize()
        .verticalScroll(rememberScrollState())
        .padding(horizontal = 20.dp)
        .padding(top = 56.dp, bottom = 76.dp),
      horizontalAlignment = Alignment.CenterHorizontally,
    ) {
      Surface(
        color = colors.primary.copy(alpha = 0.15f),
        contentColor = colors.primary,
        shape = RoundedCornerShape(loginPresentation.cardRadius),
        border = androidx.compose.foundation.BorderStroke(1.dp, colors.primary.copy(alpha = 0.30f)),
        modifier = Modifier.size(loginPresentation.brandMarkSize),
      ) {
        Box(contentAlignment = Alignment.Center) {
          Image(
            painter = painterResource(R.drawable.brand_logo),
            contentDescription = "乾坤戒产品标志",
            modifier = Modifier.size(38.dp),
          )
        }
      }
      Text(
        "乾坤戒",
        style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Bold),
        color = colors.onBackground,
        modifier = Modifier.padding(top = 16.dp),
      )
      Text(
        loginPresentation.englishName,
        style = MaterialTheme.typography.labelMedium.copy(letterSpacing = 2.sp),
        color = colors.onSurfaceVariant,
        modifier = Modifier.padding(top = 2.dp),
      )
      Text(
        loginPresentation.tagline,
        style = MaterialTheme.typography.bodyMedium,
        color = colors.onSurfaceVariant,
        modifier = Modifier.padding(top = 8.dp),
      )

      Surface(
        color = colors.surface,
        contentColor = colors.onSurface,
        shape = RoundedCornerShape(loginPresentation.cardRadius),
        border = androidx.compose.foundation.BorderStroke(1.dp, colors.outlineVariant),
        modifier = Modifier
          .fillMaxWidth()
          .padding(top = 32.dp),
      ) {
        Column(modifier = Modifier.padding(20.dp)) {
          Text("登录账号", style = MaterialTheme.typography.titleMedium, color = colors.onSurface)
          Text(
            "用户名",
            style = MaterialTheme.typography.labelMedium,
            color = colors.onSurfaceVariant,
            modifier = Modifier.padding(top = 18.dp, bottom = 6.dp),
          )
          OutlinedTextField(
            value = username,
            onValueChange = { username = it },
            modifier = Modifier.fillMaxWidth().height(loginPresentation.inputHeight),
            enabled = !submitting,
            placeholder = { Text("请输入用户名", style = MaterialTheme.typography.bodyMedium) },
            leadingIcon = { Icon(Icons.Outlined.Person, contentDescription = null, modifier = Modifier.size(18.dp)) },
            colors = fieldColors,
            shape = RoundedCornerShape(12.dp),
            singleLine = true,
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Next),
          )

          Text(
            "密码",
            style = MaterialTheme.typography.labelMedium,
            color = colors.onSurfaceVariant,
            modifier = Modifier.padding(top = 16.dp, bottom = 6.dp),
          )
          OutlinedTextField(
            value = password,
            onValueChange = { password = it },
            modifier = Modifier.fillMaxWidth().height(loginPresentation.inputHeight),
            enabled = !submitting,
            placeholder = { Text("请输入密码", style = MaterialTheme.typography.bodyMedium) },
            leadingIcon = { Icon(Icons.Outlined.Lock, contentDescription = null, modifier = Modifier.size(18.dp)) },
            trailingIcon = {
              IconButton(onClick = { passwordVisible = !passwordVisible }, enabled = !submitting) {
                Icon(
                  if (passwordVisible) Icons.Outlined.VisibilityOff else Icons.Outlined.Visibility,
                  contentDescription = if (passwordVisible) "隐藏密码" else "显示密码",
                  modifier = Modifier.size(18.dp),
                )
              }
            },
            visualTransformation = if (passwordVisible) VisualTransformation.None else PasswordVisualTransformation(),
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
            keyboardActions = KeyboardActions(onDone = { if (credentials.isSubmittable && !submitting) onLogin(credentials) }),
            colors = fieldColors,
            shape = RoundedCornerShape(12.dp),
            singleLine = true,
          )

          errorMessage?.let { message ->
            Row(
              modifier = Modifier
                .fillMaxWidth()
                .padding(top = 16.dp)
                .clip(RoundedCornerShape(10.dp))
                .background(colors.error.copy(alpha = 0.10f))
                .border(1.dp, colors.error.copy(alpha = 0.30f), RoundedCornerShape(10.dp))
                .padding(horizontal = 12.dp, vertical = 10.dp),
              horizontalArrangement = Arrangement.spacedBy(8.dp),
              verticalAlignment = Alignment.CenterVertically,
            ) {
              Icon(Icons.Outlined.ErrorOutline, contentDescription = null, tint = colors.error, modifier = Modifier.size(15.dp))
              Text(text = message, color = colors.error, style = MaterialTheme.typography.labelMedium)
            }
          }

          Button(
            onClick = { onLogin(credentials) },
            modifier = Modifier
              .fillMaxWidth()
              .padding(top = 24.dp)
              .height(loginPresentation.submitHeight),
            enabled = credentials.isSubmittable && !submitting,
            shape = RoundedCornerShape(12.dp),
          ) {
            if (submitting) {
              CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp, color = colors.onPrimary)
              Spacer(Modifier.size(10.dp))
            }
            Text(if (submitting) "正在登录…" else "登录", style = MaterialTheme.typography.titleMedium)
          }
          Text(
            loginPresentation.helpText,
            style = MaterialTheme.typography.labelMedium,
            color = colors.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
          )
        }
      }
    }
    Text(
      "v${BuildConfig.VERSION_NAME}",
      style = MaterialTheme.typography.labelMedium,
      color = colors.onSurfaceVariant,
      modifier = Modifier
        .align(Alignment.BottomCenter)
        .windowInsetsPadding(WindowInsets.navigationBars)
        .padding(bottom = 20.dp),
    )
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
  var lastExitAttemptAtMillis by rememberSaveable { mutableStateOf<Long?>(null) }
  BackHandler {
    val now = SystemClock.elapsedRealtime()
    when (ExitConfirmationPolicy.action(lastExitAttemptAtMillis, now)) {
      ExitRequestAction.Exit -> (context as? Activity)?.finishAndRemoveTask()
      ExitRequestAction.ShowHint -> {
        lastExitAttemptAtMillis = now
        Toast.makeText(context, "再返回一次退出乾坤戒", Toast.LENGTH_SHORT).show()
      }
    }
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
}
