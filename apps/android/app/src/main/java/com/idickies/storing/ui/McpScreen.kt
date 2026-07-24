package com.idickies.storing.ui

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.widget.Toast
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.ContentCopy
import androidx.compose.material.icons.outlined.DeleteOutline
import androidx.compose.material.icons.outlined.Key
import androidx.compose.material.icons.outlined.PlayArrow
import androidx.compose.material.icons.outlined.Schedule
import androidx.compose.material.icons.outlined.Security
import androidx.compose.material.icons.outlined.Sync
import androidx.compose.material.icons.outlined.ToggleOff
import androidx.compose.material.icons.outlined.ToggleOn
import androidx.compose.material.icons.outlined.WarningAmber
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.idickies.storing.mcp.McpClient
import com.idickies.storing.mcp.McpRequestLog
import com.idickies.storing.mcp.McpScope
import com.idickies.storing.mcp.McpViewModel
import com.idickies.storing.ui.components.liquidGlassSurfaceColor

@OptIn(ExperimentalMaterial3Api::class, androidx.compose.foundation.layout.ExperimentalLayoutApi::class)
@Composable
fun McpScreen(
  onBack: () -> Unit,
  viewModel: McpViewModel = hiltViewModel(),
) {
  val state by viewModel.state.collectAsState()
  var showCreateDialog by remember { mutableStateOf(false) }
  var rotatingClientId by remember { mutableStateOf<Int?>(null) }
  var deletingClient by remember { mutableStateOf<McpClient?>(null) }

  BackHandler(onBack = onBack)

  val apiKey = state.newlyCreatedApiKey ?: state.newlyRotatedApiKey
  if (apiKey != null) {
    ApiKeyRevealDialog(
      apiKey = apiKey,
      onDismiss = { viewModel.clearApiKey() },
    )
  }

  Scaffold(
    topBar = {
      TopAppBar(
        colors = TopAppBarDefaults.topAppBarColors(containerColor = liquidGlassSurfaceColor()),
        title = { Text("我的 MCP") },
        navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "返回设置") } },
        actions = {
          IconButton(onClick = { showCreateDialog = true }) { Icon(Icons.Outlined.Add, contentDescription = "创建 Client") }
        },
      )
    },
  ) { padding ->
    when {
      state.loading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
      state.error != null && state.clients.isEmpty() -> Column(Modifier.fillMaxSize().padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
        Text(state.error ?: "加载失败", color = MaterialTheme.colorScheme.error)
        Spacer(Modifier.height(12.dp))
        Button(onClick = { viewModel.load() }) { Text("重试") }
      }
      else -> LazyColumn(
        modifier = Modifier.fillMaxSize().padding(padding),
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 18.dp),
        verticalArrangement = Arrangement.spacedBy(14.dp),
      ) {
        state.limits?.let { limits ->
          item {
            Surface(color = MaterialTheme.colorScheme.primaryContainer, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth()) {
              Column(Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text("平台默认配额", style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.onPrimaryContainer)
                Text("每分钟 ${limits.rateLimitPerMinute} 次 · 每日 ${limits.rateLimitPerDay} 次 · 并发采集 ${limits.concurrentCollectLimit}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onPrimaryContainer)
                Text("创建 Client 时自动应用平台默认限额，个人无法自行修改限额。", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onPrimaryContainer)
              }
            }
          }
        }

        item { Text("MCP Clients（${state.clients.size}）", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary, modifier = Modifier.padding(start = 4.dp)) }

        if (state.clients.isEmpty()) {
          item {
            Surface(color = MaterialTheme.colorScheme.surfaceVariant, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth()) {
              Column(Modifier.padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
                Text("还没有 MCP Client", style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Text("创建 Client 后可以通过 API Key 在其他工具中调用乾坤戒的摘要和采集能力。", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
                Button(onClick = { showCreateDialog = true }) { Icon(Icons.Outlined.Add, contentDescription = null, modifier = Modifier.size(18.dp)); Spacer(Modifier.size(8.dp)); Text("创建 Client") }
              }
            }
          }
        } else {
          items(state.clients, key = { it.id }) { client ->
            McpClientCard(
              client = client,
              isRotating = state.pendingClientId == client.id,
              onToggleEnabled = { viewModel.toggleEnabled(client) },
              onToggleSaveToInbox = { viewModel.toggleSaveToInbox(client) },
              onRotateKey = { rotatingClientId = client.id },
              onDelete = { deletingClient = client },
            )
          }
        }

        if (state.logs.isNotEmpty()) {
          item { Text("调用日志（最近 ${state.logs.size} 条）", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary, modifier = Modifier.padding(start = 4.dp, top = 8.dp)) }
          items(state.logs.take(30), key = { it.id }) { log ->
            McpLogRow(log)
          }
        }
      }
    }
  }

  if (showCreateDialog) {
    CreateClientDialog(
      submitting = state.submitting,
      onDismiss = { showCreateDialog = false },
      onCreate = { name, scopes, saveToInbox ->
        viewModel.createClient(name, scopes, saveToInbox)
        showCreateDialog = false
      },
    )
  }

  rotatingClientId?.let { id ->
    AlertDialog(
      onDismissRequest = { rotatingClientId = null },
      icon = { Icon(Icons.Outlined.Key, contentDescription = null, tint = MaterialTheme.colorScheme.primary) },
      title = { Text("轮换 API Key？") },
      text = { Text("轮换后旧 Key 立即失效，新 Key 只会显示这一次。", color = MaterialTheme.colorScheme.onSurfaceVariant) },
      confirmButton = { Button(onClick = { viewModel.rotateKey(id); rotatingClientId = null }) { Text("确认轮换") } },
      dismissButton = { TextButton(onClick = { rotatingClientId = null }) { Text("取消") } },
    )
  }

  deletingClient?.let { client ->
    AlertDialog(
      onDismissRequest = { deletingClient = null },
      icon = { Icon(Icons.Outlined.DeleteOutline, contentDescription = null, tint = MaterialTheme.colorScheme.error) },
      title = { Text("删除 Client「${client.name}」？") },
      text = { Text("删除后关联的 API Key 立即吊销，无法恢复。", color = MaterialTheme.colorScheme.onSurfaceVariant) },
      confirmButton = { Button(onClick = { viewModel.deleteClient(client.id); deletingClient = null }, colors = androidx.compose.material3.ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error, contentColor = MaterialTheme.colorScheme.onError)) { Text("确认删除") } },
      dismissButton = { TextButton(onClick = { deletingClient = null }) { Text("取消") } },
    )
  }
}

@Composable
private fun McpClientCard(
  client: McpClient,
  isRotating: Boolean,
  onToggleEnabled: () -> Unit,
  onToggleSaveToInbox: () -> Unit,
  onRotateKey: () -> Unit,
  onDelete: () -> Unit,
) {
  Surface(color = MaterialTheme.colorScheme.surfaceVariant, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth()) {
    Column(Modifier.padding(15.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
      Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.Top) {
        Icon(Icons.Outlined.Security, contentDescription = null, tint = if (client.enabled) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(22.dp))
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
          Text(client.name, style = MaterialTheme.typography.titleSmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
          client.lastUsedAt?.let { Text("最近使用：$it", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant) } ?: Text("尚未使用", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
        Switch(checked = client.enabled, onCheckedChange = { onToggleEnabled() })
      }

      if (client.scopes.isNotEmpty()) {
        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
          client.scopes.forEach { scopeValue ->
            val scope = McpScope.fromValue(scopeValue)
            AssistChip(
              onClick = {},
              label = { Text(scope?.label ?: scopeValue, style = MaterialTheme.typography.labelSmall) },
              leadingIcon = { Icon(if (scope != null) Icons.Outlined.Key else Icons.Outlined.WarningAmber, contentDescription = null, modifier = Modifier.size(14.dp)) },
            )
          }
        }
      }

      Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(Icons.Outlined.Schedule, contentDescription = null, modifier = Modifier.size(18.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
        Text("采集默认保存到收件箱", style = MaterialTheme.typography.bodySmall, modifier = Modifier.weight(1f))
        Switch(checked = client.defaultSaveToInbox, onCheckedChange = { onToggleSaveToInbox() })
      }

      Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        OutlinedButton(onClick = onRotateKey, enabled = !isRotating, modifier = Modifier.weight(1f)) {
          if (isRotating) CircularProgressIndicator(modifier = Modifier.size(16.dp), strokeWidth = 2.dp)
          else Icon(Icons.Outlined.Sync, contentDescription = null, modifier = Modifier.size(18.dp))
          Spacer(Modifier.size(6.dp))
          Text("轮换 Key")
        }
        OutlinedButton(onClick = onDelete, modifier = Modifier.weight(1f)) {
          Icon(Icons.Outlined.DeleteOutline, contentDescription = null, modifier = Modifier.size(18.dp), tint = MaterialTheme.colorScheme.error)
          Spacer(Modifier.size(6.dp))
          Text("删除", color = MaterialTheme.colorScheme.error)
        }
      }
    }
  }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CreateClientDialog(
  submitting: Boolean,
  onDismiss: () -> Unit,
  onCreate: (name: String, scopes: List<String>, saveToInbox: Boolean) -> Unit,
) {
  var name by remember { mutableStateOf("") }
  var saveToInbox by remember { mutableStateOf(true) }
  val defaultScopes = remember { mutableStateOf(setOf(McpScope.SummaryCreate.value, McpScope.JobReadSelf.value)) }

  AlertDialog(
    onDismissRequest = { if (!submitting) onDismiss() },
    icon = { Icon(Icons.Outlined.Add, contentDescription = null, tint = MaterialTheme.colorScheme.primary) },
    title = { Text("创建 MCP Client") },
    text = {
      Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        OutlinedTextField(
          value = name,
          onValueChange = { name = it },
          label = { Text("Client 名称") },
          singleLine = true,
          enabled = !submitting,
          modifier = Modifier.fillMaxWidth(),
        )
        Text("权限范围", style = MaterialTheme.typography.labelLarge)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
          McpScope.entries.forEach { scope ->
            FilterChip(
              selected = scope.value in defaultScopes.value,
              onClick = {
                defaultScopes.value = if (scope.value in defaultScopes.value) defaultScopes.value - scope.value
                else defaultScopes.value + scope.value
              },
              label = { Text(scope.label, style = MaterialTheme.typography.labelSmall) },
            )
          }
        }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
          Switch(checked = saveToInbox, onCheckedChange = { saveToInbox = it }, enabled = !submitting)
          Text("采集默认保存到收件箱", style = MaterialTheme.typography.bodySmall)
        }
      }
    },
    confirmButton = { Button(onClick = { onCreate(name.trim(), defaultScopes.value.toList(), saveToInbox) }, enabled = !submitting && name.trim().length >= 2) { Text("创建") } },
    dismissButton = { TextButton(onClick = onDismiss, enabled = !submitting) { Text("取消") } },
  )
}

@Composable
private fun ApiKeyRevealDialog(apiKey: String, onDismiss: () -> Unit) {
  val context = LocalContext.current
  AlertDialog(
    onDismissRequest = onDismiss,
    icon = { Icon(Icons.Outlined.Key, contentDescription = null, tint = MaterialTheme.colorScheme.primary) },
    title = { Text("API Key（仅显示一次）") },
    text = {
      Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Surface(color = MaterialTheme.colorScheme.surfaceContainerHighest, shape = RoundedCornerShape(8.dp), modifier = Modifier.fillMaxWidth()) {
          Text(apiKey, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(12.dp))
        }
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.Top) {
          Icon(Icons.Outlined.WarningAmber, contentDescription = null, modifier = Modifier.size(18.dp), tint = MaterialTheme.colorScheme.error)
          Text("请立即复制保存。关闭后无法再次查看，不写入本地存储。", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
        }
      }
    },
    confirmButton = {
      Button(onClick = {
        val clipboard = context.getSystemService(ClipboardManager::class.java)
        clipboard?.setPrimaryClip(ClipData.newPlainText("API Key", apiKey))
        Toast.makeText(context, "已复制到剪贴板，注意安全", Toast.LENGTH_SHORT).show()
        onDismiss()
      }) {
        Icon(Icons.Outlined.ContentCopy, contentDescription = null, modifier = Modifier.size(18.dp))
        Spacer(Modifier.size(8.dp))
        Text("复制并关闭")
      }
    },
  )
}

@Composable
private fun McpLogRow(log: McpRequestLog) {
  val isError = log.status == "error" || log.status == "failed"
  Surface(color = MaterialTheme.colorScheme.surfaceVariant, shape = MaterialTheme.shapes.small, modifier = Modifier.fillMaxWidth()) {
    Row(Modifier.padding(horizontal = 12.dp, vertical = 10.dp), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.Top) {
      Icon(
        if (isError) Icons.Outlined.WarningAmber else Icons.Outlined.PlayArrow,
        contentDescription = null,
        modifier = Modifier.size(18.dp),
        tint = if (isError) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary,
      )
      Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(log.toolName, style = MaterialTheme.typography.labelMedium)
        log.url?.let { Text(it, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis) }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
          Text(log.status, style = MaterialTheme.typography.labelSmall, color = if (isError) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant)
          log.durationMs?.let { Text("${it}ms", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
          log.createdAt?.let { Text(it.take(19), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
        }
      }
    }
  }
}
