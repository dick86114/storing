package com.idickies.storing.ui

import android.content.Context
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyListState
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.Logout
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.AdminPanelSettings
import androidx.compose.material.icons.outlined.AutoStories
import androidx.compose.material.icons.outlined.Brightness4
import androidx.compose.material.icons.outlined.BugReport
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.CleaningServices
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.CloudDone
import androidx.compose.material.icons.outlined.Devices
import androidx.compose.material.icons.outlined.ExpandLess
import androidx.compose.material.icons.outlined.ExpandMore
import androidx.compose.material.icons.outlined.Fingerprint
import androidx.compose.material.icons.outlined.FolderOpen
import androidx.compose.material.icons.outlined.Hub
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material.icons.outlined.Key
import androidx.compose.material.icons.outlined.LockReset
import androidx.compose.material.icons.outlined.SmartToy
import androidx.compose.material.icons.outlined.Storage
import androidx.compose.material.icons.outlined.Sync
import androidx.compose.material.icons.outlined.TextFields
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.idickies.storing.BuildConfig
import com.idickies.storing.cache.CacheManager
import com.idickies.storing.diagnostics.DiagnosticsExporter
import com.idickies.storing.offline.AUTOMATIC_CACHE_MAX_AGE_DAYS
import com.idickies.storing.offline.AUTOMATIC_CACHE_MAX_BYTES
import com.idickies.storing.offline.AUTOMATIC_IMAGE_MAX_BYTES
import com.idickies.storing.offline.AUTOMATIC_IMAGE_MAX_COUNT
import com.idickies.storing.ui.theme.ThemeMode
import com.idickies.storing.update.GitHubTokenRules
import com.idickies.storing.update.GitHubTokenUiState
import com.idickies.storing.update.UpdateSource
import com.idickies.storing.update.settingsUpdatePresentation

private const val SETTINGS_UI_PREFERENCES = "qiankunjie_settings_ui"
private const val GITHUB_STAR_PROMPT_DISMISSED = "github_star_prompt_dismissed"
private const val GITHUB_REPOSITORY_URL = "https://github.com/dick86114/storing"
private const val GITHUB_TOKEN_CREATE_URL = "https://github.com/settings/tokens/new?description=Qiankunjie%20update%20check"

enum class SettingsSection {
  ReadingAndCache,
  Appearance,
  ArchiveAndAi,
  Updates,
  AccountAndSecurity,
  About,
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun QiankunjieSettingsScreen(
  checkingUpdate: Boolean,
  themeMode: ThemeMode,
  onThemeModeChange: (ThemeMode) -> Unit,
  onCheckUpdate: () -> Unit,
  updateSource: UpdateSource = UpdateSource.Official,
  onUpdateSourceChange: (UpdateSource) -> Unit = {},
  gitHubTokenState: GitHubTokenUiState = GitHubTokenUiState(),
  onSaveGitHubToken: (String) -> Unit = {},
  onRemoveGitHubToken: () -> Unit = {},
  onOpenReaderSettings: () -> Unit,
  onOpenChangePassword: () -> Unit,
  onOpenOfflineContent: () -> Unit,
  onOpenMcp: () -> Unit,
  onOpenAi: () -> Unit,
  onOpenCategoryManagement: () -> Unit,
  onOpenAdmin: (() -> Unit)? = null,
  biometricAvailable: Boolean = false,
  biometricEnabled: Boolean = false,
  onBiometricEnabledChange: (Boolean) -> Unit = {},
  floatingCollectEnabled: Boolean = true,
  onFloatingCollectEnabledChange: (Boolean) -> Unit = {},
  onOpenDeviceSessions: () -> Unit,
  onLogout: () -> Unit,
  onBack: () -> Unit,
  expandedSettingsSections: Set<SettingsSection>? = null,
  onToggleSettingsSection: ((SettingsSection) -> Unit)? = null,
  readerCacheViewModel: ReaderCacheSettingsViewModel = hiltViewModel(),
  listState: LazyListState = rememberLazyListState(),
) {
  var confirmLogout by remember { mutableStateOf(false) }
  var confirmClearCache by remember { mutableStateOf(false) }
  var localExpandedSections by remember { mutableStateOf(emptySet<SettingsSection>()) }
  val expandedSections = expandedSettingsSections ?: localExpandedSections
  val toggleSection: (SettingsSection) -> Unit = onToggleSettingsSection ?: { section ->
    localExpandedSections = if (section in localExpandedSections) {
      localExpandedSections - section
    } else {
      localExpandedSections + section
    }
  }
  val readerCacheState by readerCacheViewModel.state.collectAsState()
  val context = LocalContext.current
  val settingsPreferences = remember {
    context.getSharedPreferences(SETTINGS_UI_PREFERENCES, Context.MODE_PRIVATE)
  }
  var showStarPrompt by remember { mutableStateOf(false) }
  var gitHubTokenDraft by remember { mutableStateOf("") }
  val uriHandler = LocalUriHandler.current
  val update = settingsUpdatePresentation(checkingUpdate)
  LaunchedEffect(Unit) {
    showStarPrompt = !settingsPreferences.getBoolean(GITHUB_STAR_PROMPT_DISMISSED, false)
    readerCacheViewModel.refresh()
  }
  LaunchedEffect(gitHubTokenState.maskedToken) {
    if (gitHubTokenState.maskedToken != null) {
      gitHubTokenDraft = ""
    }
  }

  Scaffold(
    topBar = {
      TopAppBar(
        colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
        title = { Text("设置与更新") },
        navigationIcon = {
          IconButton(onClick = onBack) {
            Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "返回资料库")
          }
        },
      )
    },
  ) { padding ->
    LazyColumn(
      state = listState,
      modifier = Modifier.fillMaxSize().padding(padding),
      contentPadding = PaddingValues(horizontal = 16.dp, vertical = 14.dp),
      verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
      item { SettingsHeaderCard() }
      if (showStarPrompt) {
        item {
          Surface(
            modifier = Modifier.fillMaxWidth(),
            shape = MaterialTheme.shapes.medium,
            color = MaterialTheme.colorScheme.primaryContainer,
          ) {
            Row(
              modifier = Modifier.padding(start = 14.dp, top = 8.dp, bottom = 8.dp, end = 6.dp),
              horizontalArrangement = Arrangement.spacedBy(8.dp),
              verticalAlignment = Alignment.CenterVertically,
            ) {
              Icon(Icons.Filled.Star, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(18.dp))
              Text(
                "喜欢乾坤戒？点个 Star 支持一下",
                modifier = Modifier.weight(1f),
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onPrimaryContainer,
              )
              TextButton(onClick = { uriHandler.openUri(GITHUB_REPOSITORY_URL) }) {
                Text("去 Star")
              }
              IconButton(
                onClick = {
                  showStarPrompt = false
                  settingsPreferences.edit().putBoolean(GITHUB_STAR_PROMPT_DISMISSED, true).apply()
                },
                modifier = Modifier.size(28.dp),
              ) {
                Icon(Icons.Outlined.Close, contentDescription = "关闭 GitHub Star 引导", modifier = Modifier.size(18.dp))
              }
            }
          }
        }
      }

      item {
        val summary = if (readerCacheState.loading) {
          "正在统计缓存…"
        } else {
          "${readerCacheState.automaticCount} 篇 · " +
            "${readerCacheState.automaticImageCount} 张图 · " +
            CacheManager.formatSize(readerCacheState.automaticBytes)
        }
        SettingsDisclosureSection(
          icon = Icons.Outlined.AutoStories,
          title = "阅读与缓存",
          summary = summary,
          expanded = SettingsSection.ReadingAndCache in expandedSections,
          onToggle = { toggleSection(SettingsSection.ReadingAndCache) },
        ) {
          SettingsRow(
            icon = Icons.Outlined.CloudDone,
            title = "离线保存",
            detail = "固定保存完整正文与图片，不自动清理",
            onClick = onOpenOfflineContent,
          )
          SettingsRow(
            icon = Icons.Outlined.TextFields,
            title = "阅读设置",
            detail = "字号、行距与正文页边距",
            onClick = onOpenReaderSettings,
          )
          ReaderCachePolicyCard(
            state = readerCacheState,
            onClear = { confirmClearCache = true },
          )
        }
      }

      item {
        SettingsDisclosureSection(
          icon = Icons.Outlined.Brightness4,
          title = "外观与交互",
          summary = "${themeMode.label} · 快捷采集${if (floatingCollectEnabled) "开启" else "关闭"}",
          expanded = SettingsSection.Appearance in expandedSections,
          onToggle = { toggleSection(SettingsSection.Appearance) },
        ) {
          Surface(
            modifier = Modifier.fillMaxWidth(),
            color = MaterialTheme.colorScheme.surfaceVariant,
            shape = MaterialTheme.shapes.medium,
          ) {
            Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
              FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                ThemeMode.entries.forEach { option ->
                  FilterChip(
                    selected = option == themeMode,
                    onClick = { onThemeModeChange(option) },
                    label = { Text(option.label) },
                    leadingIcon = if (option == themeMode) {
                      { Icon(Icons.Outlined.CheckCircle, contentDescription = null, modifier = Modifier.size(16.dp)) }
                    } else {
                      null
                    },
                  )
                }
              }
            }
          }
          SettingsToggleRow(
            icon = Icons.Outlined.Add,
            title = "右下角采集按钮",
            detail = "在资料库显示快速采集入口",
            checked = floatingCollectEnabled,
            onCheckedChange = onFloatingCollectEnabledChange,
          )
        }
      }

      item {
        SettingsDisclosureSection(
          icon = Icons.Outlined.SmartToy,
          title = "归档与 AI",
          summary = "分类规则 · 账号级模型",
          expanded = SettingsSection.ArchiveAndAi in expandedSections,
          onToggle = { toggleSection(SettingsSection.ArchiveAndAi) },
        ) {
          SettingsRow(
            icon = Icons.Outlined.FolderOpen,
            title = "分类管理",
            detail = "维护 AI 可选择的归档分类与收录边界",
            onClick = onOpenCategoryManagement,
          )
          SettingsRow(
            icon = Icons.Outlined.SmartToy,
            title = "AI 模型",
            detail = "配置模型、自动触发和生成任务",
            onClick = onOpenAi,
          )
        }
      }

      item {
        val tokenState = if (gitHubTokenState.maskedToken != null) "令牌已配置" else "未配置令牌"
        SettingsDisclosureSection(
          icon = Icons.Outlined.Sync,
          title = "版本与更新",
          summary = "${update.title} · $tokenState",
          expanded = SettingsSection.Updates in expandedSections,
          onToggle = { toggleSection(SettingsSection.Updates) },
        ) {
          SettingsRow(
            icon = Icons.Outlined.Sync,
            title = update.title,
            detail = update.detail,
            enabled = update.enabled,
            onClick = onCheckUpdate,
          )
          UpdateSourceCard(
            updateSource = updateSource,
            onUpdateSourceChange = onUpdateSourceChange,
          )
          GitHubTokenCard(
            state = gitHubTokenState,
            draft = gitHubTokenDraft,
            onDraftChange = { gitHubTokenDraft = it },
            onSave = { onSaveGitHubToken(gitHubTokenDraft) },
            onRemove = onRemoveGitHubToken,
            onCreateToken = { uriHandler.openUri(GITHUB_TOKEN_CREATE_URL) },
          )
        }
      }

      item {
        SettingsDisclosureSection(
          icon = Icons.Outlined.Devices,
          title = "账户与安全",
          summary = "MCP · 设备会话 · 密码${if (biometricAvailable) " · 生物识别" else ""}",
          expanded = SettingsSection.AccountAndSecurity in expandedSections,
          onToggle = { toggleSection(SettingsSection.AccountAndSecurity) },
        ) {
          onOpenAdmin?.let { openAdmin ->
            SettingsRow(
              icon = Icons.Outlined.AdminPanelSettings,
              title = "管理员后台",
              detail = "用户、MCP 平台管理与审计日志",
              onClick = openAdmin,
            )
          }
          SettingsRow(
            icon = Icons.Outlined.Hub,
            title = "我的 MCP",
            detail = "管理 API Client、权限和调用日志",
            onClick = onOpenMcp,
          )
          SettingsRow(
            icon = Icons.Outlined.LockReset,
            title = "修改密码",
            detail = "修改后会退出所有设备",
            onClick = onOpenChangePassword,
          )
          SettingsRow(
            icon = Icons.Outlined.Devices,
            title = "设备会话",
            detail = "查看并撤销其他设备登录",
            onClick = onOpenDeviceSessions,
          )
          if (biometricAvailable) {
            SettingsToggleRow(
              icon = Icons.Outlined.Fingerprint,
              title = "生物识别锁定",
              detail = "切后台超过 30 秒后需要验证",
              checked = biometricEnabled,
              onCheckedChange = onBiometricEnabledChange,
            )
          }
        }
      }

      item {
        SettingsDisclosureSection(
          icon = Icons.Outlined.Info,
          title = "关于与诊断",
          summary = "版本 ${BuildConfig.VERSION_NAME} · 应用信息",
          expanded = SettingsSection.About in expandedSections,
          onToggle = { toggleSection(SettingsSection.About) },
        ) {
          SettingsRow(
            icon = Icons.Outlined.BugReport,
            title = "导出诊断信息",
            detail = "生成设备与应用诊断报告，不含敏感凭据",
            onClick = { DiagnosticsExporter.export(context) },
          )
          SettingsRow(
            icon = Icons.Outlined.Info,
            title = "应用信息",
            detail = "自托管服务地址由应用固定管理",
            onClick = {},
          )
        }
      }

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

  if (confirmClearCache) {
    QiankunjieAlertDialog(
      onDismissRequest = { confirmClearCache = false },
      icon = { Icon(Icons.Outlined.CleaningServices, contentDescription = null, tint = MaterialTheme.colorScheme.primary) },
      title = { Text("清理阅读缓存？") },
      text = {
        Text(
          "将删除自动缓存正文、正文图片和界面图片缓存；不会删除固定离线保存、收藏、分类或阅读进度。",
          color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
      },
      confirmButton = {
        TextButton(
          onClick = {
            confirmClearCache = false
            readerCacheViewModel.clearReaderCache()
          },
        ) {
          Text("清理", color = MaterialTheme.colorScheme.error)
        }
      },
      dismissButton = { TextButton(onClick = { confirmClearCache = false }) { Text("取消") } },
    )
  }

  if (confirmLogout) {
    QiankunjieAlertDialog(
      onDismissRequest = { confirmLogout = false },
      icon = { Icon(Icons.AutoMirrored.Outlined.Logout, contentDescription = null, tint = MaterialTheme.colorScheme.error) },
      title = { Text("退出当前设备？") },
      text = { Text("退出后需要重新登录才能继续访问你的资料库。", color = MaterialTheme.colorScheme.onSurfaceVariant) },
      confirmButton = {
        TextButton(onClick = { confirmLogout = false; onLogout() }) {
          Text("确认退出", color = MaterialTheme.colorScheme.error)
        }
      },
      dismissButton = { TextButton(onClick = { confirmLogout = false }) { Text("取消") } },
    )
  }
}

@Composable
private fun SettingsHeaderCard() {
  Surface(
    modifier = Modifier.fillMaxWidth(),
    shape = MaterialTheme.shapes.large,
    color = MaterialTheme.colorScheme.surface,
  ) {
    Row(
      modifier = Modifier.padding(horizontal = 16.dp, vertical = 14.dp),
      horizontalArrangement = Arrangement.spacedBy(12.dp),
      verticalAlignment = Alignment.CenterVertically,
    ) {
      Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text("乾坤戒", style = MaterialTheme.typography.titleLarge)
        Text("设置与更新", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
      }
      Text(
        "v${BuildConfig.VERSION_NAME}",
        style = MaterialTheme.typography.labelMedium,
        color = MaterialTheme.colorScheme.primary,
      )
    }
  }
}

@Composable
private fun SettingsDisclosureSection(
  icon: ImageVector,
  title: String,
  summary: String,
  expanded: Boolean,
  onToggle: () -> Unit,
  content: @Composable () -> Unit,
) {
  Surface(
    modifier = Modifier.fillMaxWidth(),
    shape = MaterialTheme.shapes.large,
    color = MaterialTheme.colorScheme.surface,
  ) {
    Column {
      Row(
        modifier = Modifier.fillMaxWidth().clickable(onClick = onToggle).padding(horizontal = 16.dp, vertical = 14.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.CenterVertically,
      ) {
        Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(22.dp))
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
          Text(title, style = MaterialTheme.typography.titleSmall)
          Text(
            summary,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
          )
        }
        Icon(
          if (expanded) Icons.Outlined.ExpandLess else Icons.Outlined.ExpandMore,
          contentDescription = if (expanded) "收起" else "展开",
          tint = MaterialTheme.colorScheme.onSurfaceVariant,
        )
      }
      AnimatedVisibility(visible = expanded) {
        Column(
          modifier = Modifier.padding(start = 14.dp, end = 14.dp, bottom = 14.dp),
          verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
          content()
        }
      }
    }
  }
}

@Composable
private fun ReaderCachePolicyCard(
  state: ReaderCacheSettingsUiState,
  onClear: () -> Unit,
) {
  Surface(
    modifier = Modifier.fillMaxWidth(),
    color = MaterialTheme.colorScheme.surfaceVariant,
    shape = MaterialTheme.shapes.medium,
  ) {
    Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
      Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(Icons.Outlined.Storage, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(20.dp))
        Text("自动缓存", style = MaterialTheme.typography.titleSmall)
        Spacer(Modifier.weight(1f))
        Text(
          if (state.loading) {
            "统计中…"
          } else {
            "${state.automaticCount} 篇 · ${state.automaticImageCount} 张图"
          },
          style = MaterialTheme.typography.labelMedium,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
      }
      Text(
        "容量上限 ${CacheManager.formatSize(AUTOMATIC_CACHE_MAX_BYTES)}；" +
          "${AUTOMATIC_CACHE_MAX_AGE_DAYS} 天未访问自动清理，空间不足时优先淘汰最久未访问内容。",
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
      )
      Text(
        "正文图片边读边缓存，单篇最多 ${AUTOMATIC_IMAGE_MAX_COUNT} 张、" +
          "${CacheManager.formatSize(AUTOMATIC_IMAGE_MAX_BYTES)}。",
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
      )
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
      ) {
        Text(
          if (state.loading) "正在计算占用…" else "当前 ${CacheManager.formatSize(state.automaticBytes)}",
          style = MaterialTheme.typography.labelMedium,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        TextButton(
          onClick = onClear,
          enabled = !state.loading && !state.clearing && state.clearableBytes > 0L,
        ) {
          if (state.clearing) {
            Text("正在清理…")
          } else {
            Icon(Icons.Outlined.CleaningServices, contentDescription = null, modifier = Modifier.size(16.dp))
            Spacer(Modifier.width(4.dp))
            Text("清理阅读缓存")
          }
        }
      }
    }
  }
}

@Composable
private fun UpdateSourceCard(
  updateSource: UpdateSource,
  onUpdateSourceChange: (UpdateSource) -> Unit,
) {
  Surface(
    modifier = Modifier.fillMaxWidth(),
    color = MaterialTheme.colorScheme.surfaceVariant,
    shape = MaterialTheme.shapes.medium,
  ) {
    Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
      Text("更新源", style = MaterialTheme.typography.titleSmall)
      FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        listOf(UpdateSource.Official, UpdateSource.GhProxy).forEach { source ->
          FilterChip(
            selected = updateSource.label == source.label,
            onClick = { onUpdateSourceChange(source) },
            label = { Text(source.label) },
          )
        }
      }
      OutlinedTextField(
        value = if (updateSource is UpdateSource.Custom) updateSource.inputValue() else "",
        onValueChange = { onUpdateSourceChange(UpdateSource.Custom(it)) },
        label = { Text("自定义 HTTPS 前缀") },
        placeholder = { Text("https://your-mirror.example") },
        singleLine = true,
        isError = updateSource is UpdateSource.Custom && updateSource.isInvalid,
        supportingText = { Text("下载后仍会校验 SHA-256。") },
        modifier = Modifier.fillMaxWidth(),
      )
    }
  }
}

@Composable
private fun GitHubTokenCard(
  state: GitHubTokenUiState,
  draft: String,
  onDraftChange: (String) -> Unit,
  onSave: () -> Unit,
  onRemove: () -> Unit,
  onCreateToken: () -> Unit,
) {
  Surface(
    modifier = Modifier.fillMaxWidth(),
    color = MaterialTheme.colorScheme.surfaceVariant,
    shape = MaterialTheme.shapes.medium,
  ) {
    Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
      Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(Icons.Outlined.Key, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(20.dp))
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
          Text("GitHub 令牌", style = MaterialTheme.typography.titleSmall)
          Text(
            "用于提高更新检测额度，仅保存在本机",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
          )
        }
      }
      if (state.maskedToken != null) {
        Row(
          modifier = Modifier.fillMaxWidth(),
          horizontalArrangement = Arrangement.spacedBy(8.dp),
          verticalAlignment = Alignment.CenterVertically,
        ) {
          Text(state.maskedToken, modifier = Modifier.weight(1f), style = MaterialTheme.typography.bodyMedium)
          TextButton(onClick = onRemove) { Text("移除") }
        }
      } else {
        OutlinedTextField(
          value = draft,
          onValueChange = onDraftChange,
          label = { Text("Personal Access Token") },
          singleLine = true,
          visualTransformation = PasswordVisualTransformation(),
          modifier = Modifier.fillMaxWidth(),
        )
        Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
          Button(
            enabled = GitHubTokenRules.normalize(draft) != null,
            onClick = onSave,
          ) {
            Text("保存令牌")
          }
        }
      }
      state.message?.let { message ->
        Text(
          message,
          style = MaterialTheme.typography.bodySmall,
          color = if (state.isError) MaterialTheme.colorScheme.error else MaterialTheme.colorScheme.onSurfaceVariant,
        )
      }
      TextButton(onClick = onCreateToken) {
        Text("创建只读令牌")
      }
    }
  }
}

@Composable
private fun SettingsToggleRow(
  icon: ImageVector,
  title: String,
  detail: String,
  checked: Boolean,
  onCheckedChange: (Boolean) -> Unit,
) {
  Surface(
    modifier = Modifier.fillMaxWidth(),
    color = MaterialTheme.colorScheme.surfaceVariant,
    shape = MaterialTheme.shapes.medium,
  ) {
    Row(
      modifier = Modifier.padding(horizontal = 14.dp, vertical = 12.dp),
      horizontalArrangement = Arrangement.spacedBy(12.dp),
      verticalAlignment = Alignment.CenterVertically,
    ) {
      Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(22.dp))
      Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(title, style = MaterialTheme.typography.titleSmall)
        Text(detail, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
      }
      Switch(checked = checked, onCheckedChange = onCheckedChange)
    }
  }
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
      modifier = Modifier.padding(horizontal = 14.dp, vertical = 12.dp),
      horizontalArrangement = Arrangement.spacedBy(12.dp),
      verticalAlignment = Alignment.CenterVertically,
    ) {
      Icon(icon, contentDescription = null, tint = iconColor, modifier = Modifier.size(22.dp))
      Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(title, style = MaterialTheme.typography.titleSmall, color = titleColor)
        Text(
          detail,
          style = MaterialTheme.typography.bodySmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
          maxLines = 2,
          overflow = TextOverflow.Ellipsis,
        )
      }
    }
  }
}
