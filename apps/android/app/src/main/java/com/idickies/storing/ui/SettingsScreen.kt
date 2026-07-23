package com.idickies.storing.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.Logout
import androidx.compose.material.icons.outlined.BatterySaver
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material.icons.outlined.Brightness4
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Sync
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.idickies.storing.BuildConfig
import com.idickies.storing.ui.components.QiankunjieGlassPanel
import com.idickies.storing.ui.theme.ThemeMode
import com.idickies.storing.ui.components.liquidGlassSurfaceColor
import com.idickies.storing.update.settingsUpdatePresentation

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun QiankunjieSettingsScreen(
  checkingUpdate: Boolean,
  themeMode: ThemeMode,
  onThemeModeChange: (ThemeMode) -> Unit,
  onCheckUpdate: () -> Unit,
  onOpenBatteryGuidance: () -> Unit,
  onLogout: () -> Unit,
  onBack: () -> Unit,
) {
  var confirmLogout by remember { mutableStateOf(false) }
  val update = settingsUpdatePresentation(checkingUpdate)
  Scaffold(
    topBar = {
      TopAppBar(
        colors = TopAppBarDefaults.topAppBarColors(containerColor = liquidGlassSurfaceColor()),
        title = { Text("设置与更新") },
        navigationIcon = {
          androidx.compose.material3.IconButton(onClick = onBack) {
            Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "返回资料库")
          }
        },
      )
    },
  ) { padding ->
    LazyColumn(
      modifier = Modifier.fillMaxSize().padding(padding),
      contentPadding = PaddingValues(horizontal = 16.dp, vertical = 18.dp),
      verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
      item {
        QiankunjieGlassPanel(modifier = Modifier.fillMaxWidth(), shape = MaterialTheme.shapes.large) {
          Column(modifier = Modifier.padding(18.dp), verticalArrangement = Arrangement.spacedBy(5.dp)) {
            Text("乾坤戒", style = MaterialTheme.typography.titleLarge)
            Text("当前设备上的应用与采集运行设置。", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
            Text("版本 ${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})", color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.labelLarge, modifier = Modifier.padding(top = 4.dp))
          }
        }
      }
      item { SettingsSectionTitle("外观") }
      item {
        Surface(color = MaterialTheme.colorScheme.surfaceVariant, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth()) {
          Column(modifier = Modifier.padding(15.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Row(horizontalArrangement = Arrangement.spacedBy(13.dp), verticalAlignment = Alignment.CenterVertically) {
              Icon(Icons.Outlined.Brightness4, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(22.dp))
              Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text("显示模式", style = MaterialTheme.typography.titleSmall)
                Text("选择浅色、深色或跟随系统", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
              }
            }
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
              ThemeMode.entries.forEach { option ->
                FilterChip(
                  selected = option == themeMode,
                  onClick = { onThemeModeChange(option) },
                  label = { Text(option.label) },
                  leadingIcon = if (option == themeMode) { { Icon(Icons.Outlined.CheckCircle, contentDescription = null, modifier = Modifier.size(16.dp)) } } else null,
                )
              }
            }
          }
        }
      }
      item { SettingsSectionTitle("版本与更新") }
      item {
        SettingsRow(
          icon = Icons.Outlined.Sync,
          title = update.title,
          detail = update.detail,
          enabled = update.enabled,
          onClick = onCheckUpdate,
        )
      }
      item { SettingsSectionTitle("采集与后台") }
      item {
        SettingsRow(
          icon = Icons.Outlined.BatterySaver,
          title = "后台采集说明",
          detail = "查看小米 / 澎湃 OS 的电池优化排查步骤",
          onClick = onOpenBatteryGuidance,
        )
      }
      item { SettingsSectionTitle("关于") }
      item {
        SettingsRow(
          icon = Icons.Outlined.Info,
          title = "应用信息",
          detail = "自托管服务地址由应用固定管理，不支持在客户端切换",
          onClick = {},
        )
      }
      item { SettingsSectionTitle("账户") }
      item {
        SettingsRow(
          icon = Icons.AutoMirrored.Outlined.Logout,
          title = "退出当前设备",
          detail = "清除当前设备上的登录会话和本地访问凭据",
          destructive = true,
          onClick = { confirmLogout = true },
        )
      }
    }
  }
  if (confirmLogout) {
    AlertDialog(
      onDismissRequest = { confirmLogout = false },
      icon = { Icon(Icons.AutoMirrored.Outlined.Logout, contentDescription = null, tint = MaterialTheme.colorScheme.error) },
      title = { Text("退出当前设备？") },
      text = { Text("退出后需要重新登录才能继续访问你的资料库。", color = MaterialTheme.colorScheme.onSurfaceVariant) },
      confirmButton = { TextButton(onClick = { confirmLogout = false; onLogout() }) { Text("确认退出", color = MaterialTheme.colorScheme.error) } },
      dismissButton = { TextButton(onClick = { confirmLogout = false }) { Text("取消") } },
    )
  }
}

@Composable
private fun SettingsSectionTitle(text: String) {
  Text(text, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary, modifier = Modifier.padding(start = 4.dp, top = 4.dp))
}

@Composable
private fun SettingsRow(
  icon: ImageVector,
  title: String,
  detail: String,
  enabled: Boolean = true,
  destructive: Boolean = false,
  onClick: () -> Unit,
) {
  val titleColor = when {
    destructive -> MaterialTheme.colorScheme.error
    enabled -> MaterialTheme.colorScheme.onSurface
    else -> MaterialTheme.colorScheme.onSurfaceVariant
  }
  val iconColor = if (destructive) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.primary
  Surface(
    modifier = Modifier.fillMaxWidth().clickable(enabled = enabled, onClick = onClick),
    color = MaterialTheme.colorScheme.surfaceVariant,
    shape = MaterialTheme.shapes.medium,
  ) {
    Row(
      modifier = Modifier.padding(horizontal = 15.dp, vertical = 14.dp),
      horizontalArrangement = Arrangement.spacedBy(13.dp),
      verticalAlignment = Alignment.CenterVertically,
    ) {
      Icon(icon, contentDescription = null, tint = iconColor, modifier = Modifier.size(22.dp))
      Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
        Text(title, style = MaterialTheme.typography.titleSmall, color = titleColor)
        Text(detail, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 2, overflow = TextOverflow.Ellipsis)
      }
    }
  }
}
