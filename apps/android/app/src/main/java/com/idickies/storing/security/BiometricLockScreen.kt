package com.idickies.storing.security

import androidx.activity.ComponentActivity
import androidx.biometric.BiometricPrompt
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Fingerprint
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.core.content.ContextCompat
import androidx.fragment.app.FragmentActivity

@Composable
fun BiometricLockScreen(
  onUnlocked: () -> Unit,
  onLogout: () -> Unit,
) {
  val context = LocalContext.current
  var error by remember { mutableStateOf<String?>(null) }
  var executor by remember { mutableStateOf<java.util.concurrent.Executor?>(null) }

  LaunchedEffect(Unit) {
    val activity = context as? FragmentActivity ?: context.findFragmentActivity()
    if (activity == null) {
      error = "无法启动生物识别"
      return@LaunchedEffect
    }
    executor = ContextCompat.getMainExecutor(context)
    showBiometricPrompt(activity, executor!!) { success, message ->
      if (success) onUnlocked()
      else error = message
    }
  }

  Surface(modifier = Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.background) {
    Column(
      modifier = Modifier.fillMaxSize().padding(32.dp),
      horizontalAlignment = Alignment.CenterHorizontally,
      verticalArrangement = Arrangement.Center,
    ) {
      Icon(Icons.Outlined.Fingerprint, contentDescription = null, modifier = Modifier.size(64.dp), tint = MaterialTheme.colorScheme.primary)
      Spacer(Modifier.height(20.dp))
      Text("乾坤戒已锁定", style = MaterialTheme.typography.headlineSmall)
      Spacer(Modifier.height(8.dp))
      Text("请通过生物识别验证以继续使用", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
      Spacer(Modifier.height(24.dp))
      error?.let {
        Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
        Spacer(Modifier.height(16.dp))
      }
      val activity = context.findFragmentActivity()
      val exec = executor
      if (activity != null && exec != null) {
        Button(onClick = { showBiometricPrompt(activity, exec) { success, message -> if (success) onUnlocked() else error = message } }) {
          Icon(Icons.Outlined.Lock, contentDescription = null, modifier = Modifier.size(18.dp))
          Spacer(Modifier.size(8.dp))
          Text("重新验证")
        }
      }
      Spacer(Modifier.height(12.dp))
      TextButton(onClick = onLogout) { Text("退出账号", color = MaterialTheme.colorScheme.error) }
    }
  }
}

private fun showBiometricPrompt(
  activity: FragmentActivity,
  executor: java.util.concurrent.Executor,
  onResult: (Boolean, String?) -> Unit,
) {
  val prompt = BiometricPrompt(activity, executor, object : BiometricPrompt.AuthenticationCallback() {
    override fun onAuthenticationSucceeded(result: BiometricPrompt.AuthenticationResult) {
      onResult(true, null)
    }

    override fun onAuthenticationError(errorCode: Int, errString: CharSequence) {
      onResult(false, errString.toString())
    }

    override fun onAuthenticationFailed() {
      // Don't dismiss here; user can retry
    }
  })
  val info = BiometricPrompt.PromptInfo.Builder()
    .setTitle("乾坤戒")
    .setSubtitle("验证身份以继续")
    .setNegativeButtonText("退出账号")
    .setAllowedAuthenticators(androidx.biometric.BiometricManager.Authenticators.BIOMETRIC_WEAK)
    .build()
  prompt.authenticate(info)
}

private fun android.content.Context.findFragmentActivity(): FragmentActivity? {
  var ctx = this
  while (ctx is android.content.ContextWrapper) {
    if (ctx is FragmentActivity) return ctx
    ctx = ctx.baseContext
  }
  return null
}
