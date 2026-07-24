package com.idickies.storing.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.DeleteOutline
import androidx.compose.material.icons.outlined.Devices
import androidx.compose.material.icons.outlined.PhoneAndroid
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.idickies.storing.auth.DeviceSessionsViewModel
import com.idickies.storing.auth.canRevokeFromDeviceManager
import com.idickies.storing.auth.isCurrentDevice
import com.idickies.storing.network.MobileSessionInfo
import com.idickies.storing.ui.components.liquidGlassSurfaceColor

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DeviceSessionsScreen(
  onBack: () -> Unit,
  viewModel: DeviceSessionsViewModel = hiltViewModel(),
) {
  val state by viewModel.state.collectAsState()
  var confirmRevocation by remember { mutableStateOf<MobileSessionInfo?>(null) }
  BackHandler(onBack = onBack)
  Scaffold(
    topBar = {
      TopAppBar(
        colors = TopAppBarDefaults.topAppBarColors(containerColor = liquidGlassSurfaceColor()),
        title = { Text("设备会话") },
        navigationIcon = {
          IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "返回设置") }
        },
        actions = {
          IconButton(onClick = viewModel::refresh, enabled = !state.loading && !state.refreshing) {
            Icon(Icons.Outlined.Refresh, contentDescription = "刷新设备会话")
          }
        },
      )
    },
  ) { padding ->
    LazyColumn(
      modifier = Modifier.fillMaxSize().padding(padding),
      contentPadding = PaddingValues(horizontal = 16.dp, vertical = 18.dp),
      verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
      item {
        Surface(color = MaterialTheme.colorScheme.primaryContainer, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth()) {
          Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("登录设备", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.onPrimaryContainer)
            Text("可撤销其他设备的移动会话。本机请通过“退出当前设备”安全退出。", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onPrimaryContainer)
          }
        }
      }
      if (state.loading || state.refreshing) item {
        Row(modifier = Modifier.fillMaxWidth().padding(vertical = 26.dp), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
          CircularProgressIndicator(modifier = Modifier.size(26.dp), strokeWidth = 2.5.dp)
        }
      }
      state.error?.let { error -> item { DeviceSessionsError(error, viewModel::refresh) } }
      if (!state.loading && state.sessions.isEmpty()) item {
        DeviceSessionsEmpty()
      }
      items(state.sessions, key = { it.id }) { session ->
        DeviceSessionCard(
          session = session,
          currentDeviceId = state.currentDeviceId,
          revoking = state.revokingSessionId == session.id,
          onRevoke = { confirmRevocation = session },
        )
      }
    }
  }
  confirmRevocation?.let { session ->
    AlertDialog(
      onDismissRequest = { confirmRevocation = null },
      icon = { Icon(Icons.Outlined.Devices, contentDescription = null, tint = MaterialTheme.colorScheme.error) },
      title = { Text("撤销这台设备？") },
      text = {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
          Text(session.deviceName, style = MaterialTheme.typography.titleSmall)
          Text("撤销后该设备下次请求时必须重新登录。", color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
      },
      confirmButton = { Button(onClick = { confirmRevocation = null; viewModel.revoke(session) }) { Text("撤销会话") } },
      dismissButton = { TextButton(onClick = { confirmRevocation = null }) { Text("取消") } },
    )
  }
}

@Composable
private fun DeviceSessionCard(
  session: MobileSessionInfo,
  currentDeviceId: String,
  revoking: Boolean,
  onRevoke: () -> Unit,
) {
  val isCurrent = session.isCurrentDevice(currentDeviceId)
  Surface(color = MaterialTheme.colorScheme.surfaceVariant, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth()) {
    Row(modifier = Modifier.padding(15.dp), horizontalArrangement = Arrangement.spacedBy(13.dp), verticalAlignment = Alignment.CenterVertically) {
      Icon(if (isCurrent) Icons.Outlined.PhoneAndroid else Icons.Outlined.Devices, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(24.dp))
      Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
        Text(session.deviceName, style = MaterialTheme.typography.titleSmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
        Text("乾坤戒 ${session.appVersion}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        session.lastUsedAt?.let { Text("最近使用：${it.replace('T', ' ').substringBefore('.')}", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant) }
        if (isCurrent) Text("当前设备", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
      }
      if (session.canRevokeFromDeviceManager(currentDeviceId)) {
        IconButton(onClick = onRevoke, enabled = !revoking) {
          if (revoking) CircularProgressIndicator(modifier = Modifier.size(20.dp), strokeWidth = 2.dp)
          else Icon(Icons.Outlined.DeleteOutline, contentDescription = "撤销 ${session.deviceName} 的会话", tint = MaterialTheme.colorScheme.error)
        }
      }
    }
  }
}

@Composable
private fun DeviceSessionsEmpty() = Surface(color = MaterialTheme.colorScheme.surfaceVariant, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth()) {
  Column(modifier = Modifier.padding(22.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
    Text("暂时没有可显示的设备会话", style = MaterialTheme.typography.titleSmall)
    Text("刷新后会显示当前账号仍有效的移动设备。", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
  }
}

@Composable
private fun DeviceSessionsError(message: String, retry: () -> Unit) = Surface(color = MaterialTheme.colorScheme.errorContainer, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth()) {
  Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
    Text(message, color = MaterialTheme.colorScheme.onErrorContainer)
    TextButton(onClick = retry) { Text("重新加载") }
  }
}
