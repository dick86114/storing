package com.idickies.storing.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.AdminPanelSettings
import androidx.compose.material.icons.outlined.Block
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.DeleteOutline
import androidx.compose.material.icons.outlined.History
import androidx.compose.material.icons.outlined.LockReset
import androidx.compose.material.icons.outlined.Person
import androidx.compose.material.icons.outlined.PersonAdd
import androidx.compose.material.icons.outlined.Security
import androidx.compose.material.icons.outlined.Shield
import androidx.compose.material.icons.outlined.Tune
import androidx.compose.material.icons.outlined.WarningAmber
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
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
import androidx.compose.material3.Tab
import androidx.compose.material3.TabRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.idickies.storing.admin.AdminAuditLog
import com.idickies.storing.admin.AdminMcpClient
import com.idickies.storing.admin.AdminMcpRequestLog
import com.idickies.storing.admin.AdminUser
import com.idickies.storing.admin.AdminViewModel
import com.idickies.storing.ui.components.liquidGlassSurfaceColor

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun AdminScreen(
  onBack: () -> Unit,
  viewModel: AdminViewModel = hiltViewModel(),
) {
  val state by viewModel.state.collectAsState()
  var selectedTab by remember { mutableIntStateOf(0) }
  var showCreateUser by remember { mutableStateOf(false) }
  var editingUser by remember { mutableStateOf<AdminUser?>(null) }
  var pendingDeletionUser by remember { mutableStateOf<AdminUser?>(null) }

  BackHandler(onBack = onBack)

  Scaffold(
    topBar = {
      TopAppBar(
        colors = TopAppBarDefaults.topAppBarColors(containerColor = liquidGlassSurfaceColor()),
        title = { Text("管理员后台") },
        navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "返回设置") } },
      )
    },
  ) { padding ->
    Column(modifier = Modifier.fillMaxSize().padding(padding)) {
      TabRow(selectedTabIndex = selectedTab) {
        Tab(selected = selectedTab == 0, onClick = { selectedTab = 0 }, text = { Text("用户(${state.users.size})") }, icon = { Icon(Icons.Outlined.Person, contentDescription = null, modifier = Modifier.size(18.dp)) })
        Tab(selected = selectedTab == 1, onClick = { selectedTab = 1 }, text = { Text("MCP 平台") }, icon = { Icon(Icons.Outlined.Security, contentDescription = null, modifier = Modifier.size(18.dp)) })
        Tab(selected = selectedTab == 2, onClick = { selectedTab = 2 }, text = { Text("审计日志") }, icon = { Icon(Icons.Outlined.History, contentDescription = null, modifier = Modifier.size(18.dp)) })
      }

      when {
        state.loading -> Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) { CircularProgressIndicator() }
        state.forbidden -> Column(Modifier.fillMaxSize().padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
          Icon(Icons.Outlined.Block, contentDescription = null, tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(48.dp))
          Spacer(Modifier.height(12.dp))
          Text("需要管理员权限", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.error)
        }
        else -> when (selectedTab) {
          0 -> AdminUsersTab(
            users = state.users,
            onCreateClick = { showCreateUser = true },
            onEditUser = { editingUser = it },
          )
          1 -> AdminMcpTab(
            clients = state.mcpClients,
            logs = state.mcpLogs,
            limits = state.mcpLimits,
            submitting = state.submitting,
            onUpdateLimits = { perMin, perDay, concurrent -> viewModel.updateMcpLimits(perMin, perDay, concurrent) },
          )
          2 -> AdminAuditTab(logs = state.auditLogs)
        }
      }

      state.notice?.let { notice ->
        Surface(color = MaterialTheme.colorScheme.primaryContainer, modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp), shape = MaterialTheme.shapes.small) {
          Text(notice, color = MaterialTheme.colorScheme.onPrimaryContainer, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(12.dp))
        }
      }
      state.error?.let { error ->
        Surface(color = MaterialTheme.colorScheme.errorContainer, modifier = Modifier.fillMaxWidth().padding(16.dp), shape = MaterialTheme.shapes.small) {
          Text(error, color = MaterialTheme.colorScheme.onError, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(12.dp))
        }
      }
    }
  }

  if (showCreateUser) {
    CreateUserDialog(
      submitting = state.submitting,
      onDismiss = { showCreateUser = false },
      onCreate = { username, password, role ->
        viewModel.createUser(username, password, role)
        showCreateUser = false
      },
    )
  }

  editingUser?.let { user ->
    EditUserDialog(
      user = user,
      submitting = state.submitting,
      onDismiss = { editingUser = null },
      onUpdate = { username, role, status, password ->
        viewModel.updateUser(user.id, username, role, status, password)
        editingUser = null
      },
      onRequestDelete = {
        editingUser = null
        pendingDeletionUser = user
      },
    )
  }

  pendingDeletionUser?.let { user ->
    val wasDeleted = state.users.none { it.id == user.id }
    LaunchedEffect(wasDeleted) {
      if (wasDeleted) pendingDeletionUser = null
    }
    if (!wasDeleted) {
      DeleteUserDialog(
        user = user,
        submitting = state.submitting,
        onDismiss = { pendingDeletionUser = null },
        onDelete = { viewModel.deleteUser(user.id) },
      )
    }
  }
}

internal data class AdminUserDeletionPresentation(
  val title: String,
  val requiredConfirmation: String,
  val warning: String,
)

internal fun canDeleteAdminUser(user: AdminUser): Boolean = user.role != "admin"

internal fun adminUserDeletionPresentation(user: AdminUser): AdminUserDeletionPresentation =
  AdminUserDeletionPresentation(
    title = "永久删除用户",
    requiredConfirmation = user.username,
    warning = "将清理该用户的资料库内容、采集任务、设备登录和 MCP 连接。此操作不可恢复。",
  )

@Composable
private fun AdminUsersTab(users: List<AdminUser>, onCreateClick: () -> Unit, onEditUser: (AdminUser) -> Unit) {
  LazyColumn(
    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
    verticalArrangement = Arrangement.spacedBy(8.dp),
  ) {
    item {
      OutlinedButton(onClick = onCreateClick, modifier = Modifier.fillMaxWidth()) {
        Icon(Icons.Outlined.PersonAdd, contentDescription = null, modifier = Modifier.size(18.dp))
        Spacer(Modifier.size(8.dp))
        Text("创建用户")
      }
    }
    items(users, key = { it.id }) { user ->
      AdminUserRow(user = user, onEdit = { onEditUser(user) })
    }
  }
}

@Composable
private fun AdminUserRow(user: AdminUser, onEdit: () -> Unit) {
  val isActive = user.status == "active"
  Surface(color = MaterialTheme.colorScheme.surfaceVariant, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp)) {
    Row(Modifier.padding(horizontal = 14.dp, vertical = 12.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
      Icon(
        if (isActive) Icons.Outlined.Person else Icons.Outlined.Block,
        contentDescription = null,
        tint = if (isActive) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error,
        modifier = Modifier.size(22.dp),
      )
      Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
          Text(user.username, style = MaterialTheme.typography.titleSmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
          AssistChip(onClick = {}, label = { Text(user.role, style = MaterialTheme.typography.labelSmall) })
          if (!isActive) AssistChip(onClick = {}, label = { Text("已禁用", style = MaterialTheme.typography.labelSmall) }, leadingIcon = { Icon(Icons.Outlined.Block, contentDescription = null, modifier = Modifier.size(14.dp)) })
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
          Text("收件箱 ${user.inboxCount}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
          Text("收藏 ${user.favoriteCount}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
          Text("归档 ${user.archiveCount}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
          Text("MCP ${user.mcpClientCount}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
      }
      IconButton(onClick = onEdit) { Icon(Icons.Outlined.Tune, contentDescription = "编辑用户") }
    }
  }
}

@Composable
private fun AdminMcpTab(
  clients: List<AdminMcpClient>,
  logs: List<AdminMcpRequestLog>,
  limits: com.idickies.storing.admin.AdminMcpPlatformLimits?,
  submitting: Boolean,
  onUpdateLimits: (Int, Int, Int) -> Unit,
) {
  var showEditLimits by remember { mutableStateOf(false) }

  LazyColumn(
    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
    verticalArrangement = Arrangement.spacedBy(10.dp),
  ) {
    if (limits != null) {
      item {
        Surface(color = MaterialTheme.colorScheme.primaryContainer, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth()) {
          Row(Modifier.padding(16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Outlined.Shield, contentDescription = null, tint = MaterialTheme.colorScheme.onPrimaryContainer, modifier = Modifier.size(24.dp))
            Column(Modifier.weight(1f)) {
              Text("平台默认配额", style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.onPrimaryContainer)
              Text("每分钟 ${limits.rateLimitPerMinute} · 每日 ${limits.rateLimitPerDay} · 并发 ${limits.concurrentCollectLimit}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onPrimaryContainer)
            }
            OutlinedButton(onClick = { showEditLimits = true }) { Text("修改") }
          }
        }
      }
    }

    item { Text("所有 MCP Clients（${clients.size}）", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary, modifier = Modifier.padding(start = 4.dp)) }

    items(clients, key = { it.id }) { client ->
      Surface(color = MaterialTheme.colorScheme.surfaceVariant, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth()) {
        Column(Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
          Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(client.name, style = MaterialTheme.typography.titleSmall, modifier = Modifier.weight(1f))
            Text(client.ownerUsername ?: "用户#${client.ownerUserId}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            if (client.enabled) AssistChip(onClick = {}, label = { Text("启用") }, leadingIcon = { Icon(Icons.Outlined.CheckCircle, contentDescription = null, modifier = Modifier.size(14.dp)) })
            else AssistChip(onClick = {}, label = { Text("停用") })
          }
          Text("scopes: ${client.scopes.joinToString(", ")}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
      }
    }

    if (logs.isNotEmpty()) {
      item { Text("平台调用日志（最近 ${logs.size} 条）", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary, modifier = Modifier.padding(start = 4.dp, top = 8.dp)) }
      items(logs.take(20), key = { it.id }) { log ->
        val isError = log.status == "error" || log.status == "failed"
        Surface(color = MaterialTheme.colorScheme.surfaceVariant, shape = MaterialTheme.shapes.small, modifier = Modifier.fillMaxWidth()) {
          Row(Modifier.padding(horizontal = 12.dp, vertical = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.Top) {
            Icon(if (isError) Icons.Outlined.WarningAmber else Icons.Outlined.CheckCircle, contentDescription = null, modifier = Modifier.size(16.dp), tint = if (isError) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary)
            Column(Modifier.weight(1f)) {
              Text(log.toolName, style = MaterialTheme.typography.labelMedium)
              log.url?.let { Text(it, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis) }
              Text("${log.status} · ${log.durationMs ?: 0}ms · ${log.createdAt?.take(19) ?: ""}", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
          }
        }
      }
    }
  }

  if (showEditLimits && limits != null) {
    var perMin by remember { mutableStateOf(limits.rateLimitPerMinute.toString()) }
    var perDay by remember { mutableStateOf(limits.rateLimitPerDay.toString()) }
    var concurrent by remember { mutableStateOf(limits.concurrentCollectLimit.toString()) }
    QiankunjieAlertDialog(
      onDismissRequest = { showEditLimits = false },
      icon = { Icon(Icons.Outlined.Tune, contentDescription = null, tint = MaterialTheme.colorScheme.primary) },
      title = { Text("修改平台默认配额") },
      text = {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
          OutlinedTextField(value = perMin, onValueChange = { perMin = it.filter { c -> c.isDigit() } }, label = { Text("每分钟限额") }, singleLine = true, modifier = Modifier.fillMaxWidth())
          OutlinedTextField(value = perDay, onValueChange = { perDay = it.filter { c -> c.isDigit() } }, label = { Text("每日限额") }, singleLine = true, modifier = Modifier.fillMaxWidth())
          OutlinedTextField(value = concurrent, onValueChange = { concurrent = it.filter { c -> c.isDigit() } }, label = { Text("并发采集数") }, singleLine = true, modifier = Modifier.fillMaxWidth())
        }
      },
      confirmButton = { Button(onClick = { onUpdateLimits(perMin.toIntOrNull() ?: 0, perDay.toIntOrNull() ?: 0, concurrent.toIntOrNull() ?: 0); showEditLimits = false }, enabled = !submitting) { Text("保存") } },
      dismissButton = { TextButton(onClick = { showEditLimits = false }) { Text("取消") } },
    )
  }
}

@Composable
private fun AdminAuditTab(logs: List<AdminAuditLog>) {
  LazyColumn(
    contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
    verticalArrangement = Arrangement.spacedBy(8.dp),
  ) {
    items(logs, key = { it.id }) { log ->
      Surface(color = MaterialTheme.colorScheme.surfaceVariant, shape = MaterialTheme.shapes.small, modifier = Modifier.fillMaxWidth()) {
        Row(Modifier.padding(horizontal = 12.dp, vertical = 10.dp), horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.Top) {
          Icon(Icons.Outlined.History, contentDescription = null, modifier = Modifier.size(18.dp), tint = MaterialTheme.colorScheme.primary)
          Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(log.action, style = MaterialTheme.typography.labelMedium)
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
              log.actorUsername?.let { Text("操作者：$it", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
              log.targetUsername?.let { Text("目标：$it", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
            }
            log.articleTitle?.let { Text("文章：$it", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis) }
            log.detailText?.let { Text(it, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
            Text(log.createdAt?.take(19) ?: "", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
          }
        }
      }
    }
  }
}

@Composable
private fun CreateUserDialog(submitting: Boolean, onDismiss: () -> Unit, onCreate: (String, String, String) -> Unit) {
  var username by remember { mutableStateOf("") }
  var password by remember { mutableStateOf("") }
  var role by remember { mutableStateOf("user") }
  QiankunjieAlertDialog(
    onDismissRequest = { if (!submitting) onDismiss() },
    icon = { Icon(Icons.Outlined.PersonAdd, contentDescription = null, tint = MaterialTheme.colorScheme.primary) },
    title = { Text("创建用户") },
    text = {
      Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        OutlinedTextField(value = username, onValueChange = { username = it }, label = { Text("用户名") }, singleLine = true, enabled = !submitting, modifier = Modifier.fillMaxWidth())
        OutlinedTextField(value = password, onValueChange = { password = it }, label = { Text("密码（至少 12 位）") }, singleLine = true, enabled = !submitting, modifier = Modifier.fillMaxWidth())
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
          listOf("user" to "普通用户", "admin" to "管理员", "service" to "服务").forEach { (value, label) ->
            FilterChip(selected = role == value, onClick = { role = value }, label = { Text(label, style = MaterialTheme.typography.labelSmall) })
          }
        }
      }
    },
    confirmButton = { Button(onClick = { onCreate(username.trim(), password, role) }, enabled = !submitting && username.trim().length >= 2 && password.length >= 12) { Text("创建") } },
    dismissButton = { TextButton(onClick = onDismiss, enabled = !submitting) { Text("取消") } },
  )
}

@Composable
private fun EditUserDialog(
  user: AdminUser,
  submitting: Boolean,
  onDismiss: () -> Unit,
  onUpdate: (String?, String?, String?, String?) -> Unit,
  onRequestDelete: () -> Unit,
) {
  var username by remember { mutableStateOf(user.username) }
  var role by remember { mutableStateOf(user.role) }
  var status by remember { mutableStateOf(user.status) }
  var password by remember { mutableStateOf("") }
  var confirmPassword by remember { mutableStateOf("") }
  var showPasswordFields by remember { mutableStateOf(false) }
  var confirmAction by remember { mutableStateOf<String?>(null) }

  val action = confirmAction
  if (action != null) {
    QiankunjieAlertDialog(
      onDismissRequest = { confirmAction = null },
      icon = { Icon(Icons.Outlined.WarningAmber, contentDescription = null, tint = MaterialTheme.colorScheme.error) },
      title = { Text(action) },
      text = { Text("确认对用户「${user.username}」执行此操作？", color = MaterialTheme.colorScheme.onSurfaceVariant) },
      confirmButton = { Button(onClick = {
        val newPassword = if (showPasswordFields && password.length >= 12 && password == confirmPassword) password else null
        val newStatus = if (status != user.status) status else null
        val newRole = if (role != user.role) role else null
        val newUsername = if (username.trim() != user.username) username.trim() else null
        onUpdate(newUsername, newRole, newStatus, newPassword)
        confirmAction = null
      }) { Text("确认") } },
      dismissButton = { TextButton(onClick = { confirmAction = null }) { Text("取消") } },
    )
  } else {
    QiankunjieAlertDialog(
      onDismissRequest = { if (!submitting) onDismiss() },
      icon = { Icon(Icons.Outlined.Tune, contentDescription = null, tint = MaterialTheme.colorScheme.primary) },
      title = { Text("编辑用户「${user.username}」") },
      text = {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
          OutlinedTextField(value = username, onValueChange = { username = it }, label = { Text("用户名") }, singleLine = true, enabled = !submitting, modifier = Modifier.fillMaxWidth())
          Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("user" to "普通用户", "admin" to "管理员", "service" to "服务").forEach { (value, label) ->
              FilterChip(selected = role == value, onClick = { role = value }, label = { Text(label, style = MaterialTheme.typography.labelSmall) })
            }
          }
          Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            listOf("active" to "正常", "disabled" to "禁用").forEach { (value, label) ->
              FilterChip(selected = status == value, onClick = { status = value }, label = { Text(label, style = MaterialTheme.typography.labelSmall) })
            }
          }
          if (showPasswordFields) {
            OutlinedTextField(value = password, onValueChange = { password = it }, label = { Text("新密码（至少 12 位）") }, singleLine = true, enabled = !submitting, modifier = Modifier.fillMaxWidth())
            OutlinedTextField(value = confirmPassword, onValueChange = { confirmPassword = it }, label = { Text("确认新密码") }, singleLine = true, enabled = !submitting, modifier = Modifier.fillMaxWidth())
          } else {
            OutlinedButton(onClick = { showPasswordFields = true }, enabled = !submitting) {
              Icon(Icons.Outlined.LockReset, contentDescription = null, modifier = Modifier.size(18.dp))
              Spacer(Modifier.size(8.dp))
              Text("重置密码")
            }
          }
          if (canDeleteAdminUser(user)) {
            Spacer(Modifier.height(4.dp))
            OutlinedButton(
              onClick = onRequestDelete,
              enabled = !submitting,
              modifier = Modifier.fillMaxWidth(),
              colors = ButtonDefaults.outlinedButtonColors(contentColor = MaterialTheme.colorScheme.error),
            ) {
              Icon(Icons.Outlined.DeleteOutline, contentDescription = null, modifier = Modifier.size(18.dp))
              Spacer(Modifier.size(8.dp))
              Text("删除用户")
            }
          }
        }
      },
      confirmButton = { Button(onClick = {
        val needsConfirm = status != user.status || role != user.role || (showPasswordFields && password.isNotBlank())
        if (needsConfirm) confirmAction = "确认修改"
        else {
          val newUsername = if (username.trim() != user.username) username.trim() else null
          if (newUsername != null) onUpdate(newUsername, null, null, null) else onDismiss()
        }
      }, enabled = !submitting) { Text("保存") } },
      dismissButton = { TextButton(onClick = onDismiss, enabled = !submitting) { Text("取消") } },
    )
  }
}

@Composable
private fun DeleteUserDialog(
  user: AdminUser,
  submitting: Boolean,
  onDismiss: () -> Unit,
  onDelete: () -> Unit,
) {
  val presentation = adminUserDeletionPresentation(user)
  var confirmation by remember(user.id) { mutableStateOf("") }
  val canConfirm = confirmation.trim() == presentation.requiredConfirmation && !submitting

  QiankunjieAlertDialog(
    onDismissRequest = { if (!submitting) onDismiss() },
    icon = { Icon(Icons.Outlined.WarningAmber, contentDescription = null, tint = MaterialTheme.colorScheme.error) },
    title = { Text(presentation.title) },
    text = {
      Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text("确定要删除用户「${user.username}」吗？", color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text(presentation.warning, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
        OutlinedTextField(
          value = confirmation,
          onValueChange = { confirmation = it },
          label = { Text("输入「${presentation.requiredConfirmation}」确认") },
          singleLine = true,
          enabled = !submitting,
          modifier = Modifier.fillMaxWidth(),
        )
      }
    },
    confirmButton = {
      Button(
        onClick = onDelete,
        enabled = canConfirm,
        colors = ButtonDefaults.buttonColors(
          containerColor = MaterialTheme.colorScheme.error,
          contentColor = MaterialTheme.colorScheme.onError,
        ),
      ) {
        if (submitting) {
          CircularProgressIndicator(
            modifier = Modifier.size(18.dp),
            color = MaterialTheme.colorScheme.onError,
            strokeWidth = 2.dp,
          )
          Spacer(Modifier.size(8.dp))
          Text("删除中")
        } else {
          Text("永久删除")
        }
      }
    },
    dismissButton = { TextButton(onClick = onDismiss, enabled = !submitting) { Text("取消") } },
  )
}
