package com.idickies.storing.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.Lock
import androidx.compose.material.icons.outlined.Visibility
import androidx.compose.material.icons.outlined.VisibilityOff
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.idickies.storing.auth.AuthRepository
import com.idickies.storing.ui.components.liquidGlassSurfaceColor
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class ChangePasswordUiState(
  val submitting: Boolean = false,
  val error: String? = null,
  val success: Boolean = false,
)

@HiltViewModel
class ChangePasswordViewModel @Inject constructor(
  private val authRepository: AuthRepository,
) : ViewModel() {
  private val mutableState = MutableStateFlow(ChangePasswordUiState())
  val state = mutableState.asStateFlow()

  fun submit(currentPassword: String, newPassword: String, confirmPassword: String) {
    when {
      currentPassword.isBlank() -> mutableState.update { it.copy(error = "请输入当前密码") }
      newPassword.length < 12 -> mutableState.update { it.copy(error = "新密码至少需要 12 个字符") }
      newPassword.length > 256 -> mutableState.update { it.copy(error = "新密码过长") }
      newPassword != confirmPassword -> mutableState.update { it.copy(error = "两次输入的新密码不一致") }
      newPassword == currentPassword -> mutableState.update { it.copy(error = "新密码不能与当前密码相同") }
      else -> {
        mutableState.update { it.copy(submitting = true, error = null) }
        viewModelScope.launch {
          runCatching { authRepository.changePassword(currentPassword, newPassword) }
            .onSuccess { mutableState.update { it.copy(submitting = false, success = true) } }
            .onFailure { error -> mutableState.update { it.copy(submitting = false, error = error.message ?: "修改密码失败") } }
        }
      }
    }
  }

  fun clearError() = mutableState.update { it.copy(error = null) }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChangePasswordScreen(
  onBack: () -> Unit,
  onPasswordChanged: () -> Unit,
  viewModel: ChangePasswordViewModel = hiltViewModel(),
) {
  val state by viewModel.state.collectAsState()
  val scope = rememberCoroutineScope()

  var currentPassword by remember { mutableStateOf("") }
  var newPassword by remember { mutableStateOf("") }
  var confirmPassword by remember { mutableStateOf("") }
  var showCurrent by remember { mutableStateOf(false) }
  var showNew by remember { mutableStateOf(false) }
  var showConfirm by remember { mutableStateOf(false) }

  BackHandler(onBack = onBack)

  if (state.success) {
    onPasswordChanged()
    return
  }

  Scaffold(
    topBar = {
      TopAppBar(
        colors = TopAppBarDefaults.topAppBarColors(containerColor = liquidGlassSurfaceColor()),
        title = { Text("修改密码") },
        navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "返回设置") } },
      )
    },
  ) { padding ->
    Column(
      modifier = Modifier.fillMaxSize().padding(padding).padding(horizontal = 20.dp, vertical = 18.dp),
      verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
      Surface(color = MaterialTheme.colorScheme.primaryContainer, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
          Text("修改密码后会退出所有设备", style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.onPrimaryContainer)
          Text("为安全起见，修改密码后将撤销所有移动设备会话，你需要用新密码重新登录。", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onPrimaryContainer)
        }
      }

      PasswordField(
        label = "当前密码",
        value = currentPassword,
        onValueChange = { currentPassword = it; viewModel.clearError() },
        showPassword = showCurrent,
        onToggleShow = { showCurrent = !showCurrent },
        enabled = !state.submitting,
      )

      PasswordField(
        label = "新密码",
        value = newPassword,
        onValueChange = { newPassword = it; viewModel.clearError() },
        showPassword = showNew,
        onToggleShow = { showNew = !showNew },
        enabled = !state.submitting,
        supportingText = "至少 12 个字符",
      )

      PasswordField(
        label = "确认新密码",
        value = confirmPassword,
        onValueChange = { confirmPassword = it; viewModel.clearError() },
        showPassword = showConfirm,
        onToggleShow = { showConfirm = !showConfirm },
        enabled = !state.submitting,
        imeAction = ImeAction.Done,
      )

      state.error?.let { error ->
        Text(error, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
      }

      Button(
        onClick = { viewModel.submit(currentPassword, newPassword, confirmPassword) },
        enabled = !state.submitting && currentPassword.isNotBlank() && newPassword.isNotBlank() && confirmPassword.isNotBlank(),
        modifier = Modifier.fillMaxWidth(),
        contentPadding = PaddingValues(vertical = 14.dp),
      ) {
        if (state.submitting) {
          CircularProgressIndicator(modifier = Modifier.padding(end = 8.dp), strokeWidth = 2.dp, color = MaterialTheme.colorScheme.onPrimary)
        }
        Text(if (state.submitting) "正在修改…" else "确认修改密码")
      }
    }
  }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun PasswordField(
  label: String,
  value: String,
  onValueChange: (String) -> Unit,
  showPassword: Boolean,
  onToggleShow: () -> Unit,
  enabled: Boolean,
  supportingText: String? = null,
  imeAction: ImeAction = ImeAction.Next,
) {
  OutlinedTextField(
    value = value,
    onValueChange = onValueChange,
    label = { Text(label) },
    enabled = enabled,
    singleLine = true,
    visualTransformation = if (showPassword) VisualTransformation.None else PasswordVisualTransformation(),
    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Password, imeAction = imeAction),
    trailingIcon = {
      IconButton(onClick = onToggleShow) {
        Icon(if (showPassword) Icons.Outlined.VisibilityOff else Icons.Outlined.Visibility, contentDescription = if (showPassword) "隐藏密码" else "显示密码")
      }
    },
    leadingIcon = { Icon(Icons.Outlined.Lock, contentDescription = null) },
    supportingText = supportingText?.let { { Text(it) } },
    modifier = Modifier.fillMaxWidth(),
  )
}
