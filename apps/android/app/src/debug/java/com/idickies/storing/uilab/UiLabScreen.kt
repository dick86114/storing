package com.idickies.storing.uilab

import com.idickies.storing.ui.theme.isQiankunjieDarkTheme

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.OpenInNew
import androidx.compose.material.icons.automirrored.outlined.Label
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.Inbox
import androidx.compose.material.icons.outlined.AddLink
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Archive
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.outlined.AutoStories
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material.icons.outlined.Public
import androidx.compose.material.icons.outlined.FilterList
import androidx.compose.material.icons.outlined.IosShare
import androidx.compose.material.icons.outlined.Link
import androidx.compose.material.icons.outlined.MoreVert
import androidx.compose.material.icons.outlined.Replay
import androidx.compose.material.icons.outlined.Sync
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.automirrored.outlined.Sort
import androidx.compose.material.icons.outlined.TaskAlt
import androidx.compose.material3.AssistChip
import androidx.compose.material3.AssistChipDefaults
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.FloatingActionButton
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
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import com.idickies.storing.ui.components.ActiveCollectJobsCard
import com.idickies.storing.ui.components.ReaderActionBar
import com.idickies.storing.reader.ReaderWebView
import com.idickies.storing.ui.QiankunjieSettingsScreen
import com.idickies.storing.ui.CategoryManagementScreen
import com.idickies.storing.ui.LoginScreen
import com.idickies.storing.ui.SharePosterScreen
import com.idickies.storing.ui.ArticleDetailSkeleton
import com.idickies.storing.ui.LibraryMoreMenu
import com.idickies.storing.ui.libraryControlMetrics
import com.idickies.storing.ui.libraryArchiveControlMetrics
import com.idickies.storing.ui.LibrarySortMenu
import com.idickies.storing.ui.LibrarySourceMenu
import com.idickies.storing.ui.LibraryPresentationModeSelector
import com.idickies.storing.ui.LibraryEmptyState
import com.idickies.storing.ui.LibrarySearchScreen
import com.idickies.storing.ui.theme.ThemeMode
import com.idickies.storing.library.ArchiveSourceFilter
import com.idickies.storing.library.ArticleListPresentationMode
import com.idickies.storing.library.LibrarySort
import com.idickies.storing.library.LibraryView
import com.idickies.storing.library.LibraryUiState
import com.idickies.storing.ui.components.liquidGlassSurfaceColor
import com.idickies.storing.ui.components.liquidGlassBackdropBrush
import com.idickies.storing.ui.components.liquidGlass
import com.idickies.storing.ui.components.LiquidGlassRole
import com.idickies.storing.ui.components.QiankunjieArticleCard
import com.idickies.storing.ui.components.QiankunjieGridArticleCard
import com.idickies.storing.ui.components.QiankunjieCompactArticleRow
import com.idickies.storing.ui.components.QiankunjieCompactBottomBar
import com.idickies.storing.ui.components.CompactBottomBarItem

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun UiLabScreen(
  initialScenario: UiLabScenario,
  onClose: () -> Unit,
) {
  var scenarioRoute by rememberSaveable { mutableStateOf(initialScenario.route) }
  var previewMoreExpanded by rememberSaveable { mutableStateOf(false) }
  var previewThemeMode by rememberSaveable { mutableStateOf(ThemeMode.System) }
  var previewPresentationMode by remember { mutableStateOf(ArticleListPresentationMode.Grid) }
  val scenario = UiLabScenario.fromRoute(scenarioRoute)
  if (scenario == UiLabScenario.Search) {
    LibrarySearchScreen(
      initialQuery = "",
      state = LibraryUiState(articles = UiLabFixtures.library, loading = false),
      onBack = { scenarioRoute = UiLabScenario.Library.route },
      onSearch = {},
      onOpen = {},
      onLongPress = {},
    )
    return
  }
  if (scenario == UiLabScenario.Poster) {
    SharePosterScreen(
      article = UiLabFixtures.posterArticle,
      publicUrl = "https://storing.idickies.cc/p/240",
      onBack = onClose,
    )
    return
  }
  if (scenario == UiLabScenario.Categories) {
    CategoryManagementScreen(onBack = onClose)
    return
  }
  val isDarkAppearance = isQiankunjieDarkTheme()
  Scaffold(
    modifier = Modifier.background(liquidGlassBackdropBrush()),
    containerColor = Color.Transparent,
    contentColor = MaterialTheme.colorScheme.onBackground,
    floatingActionButton = {
      if (scenario == UiLabScenario.Library) {
        if (isDarkAppearance) {
          FloatingActionButton(
            onClick = {},
            containerColor = MaterialTheme.colorScheme.primary,
            contentColor = MaterialTheme.colorScheme.onPrimary,
            shape = CircleShape,
          ) { Icon(Icons.Outlined.Add, contentDescription = "采集", modifier = Modifier.size(32.dp)) }
        } else {
          Box(
            modifier = Modifier
              .size(62.dp)
              .liquidGlass(CircleShape, LiquidGlassRole.Accent, MaterialTheme.colorScheme.primary),
            contentAlignment = Alignment.Center,
          ) {
            IconButton(onClick = {}, modifier = Modifier.fillMaxSize()) {
              Icon(Icons.Outlined.Add, contentDescription = "采集", tint = MaterialTheme.colorScheme.onPrimary, modifier = Modifier.size(32.dp))
            }
          }
        }
      }
    },
    bottomBar = {
      if (scenario == UiLabScenario.Library) {
        QiankunjieCompactBottomBar {
          CompactBottomBarItem(label = "收件箱", icon = Icons.Outlined.Inbox, selected = true, badgeCount = 2, onClick = {})
          CompactBottomBarItem(label = "收藏", icon = Icons.Outlined.FavoriteBorder, selected = false, onClick = {})
          CompactBottomBarItem(label = "归档", icon = Icons.Outlined.Archive, selected = false, onClick = {})
          CompactBottomBarItem(label = "发布", icon = Icons.Outlined.Public, selected = false, onClick = {})
        }
      }
    },
    topBar = {
      TopAppBar(
        colors = TopAppBarDefaults.topAppBarColors(containerColor = liquidGlassSurfaceColor()),
        title = { Text("乾坤戒 UI Lab") },
        navigationIcon = { IconButton(onClick = onClose) { Icon(Icons.Outlined.Close, contentDescription = "关闭 UI Lab") } },
        actions = {
          if (scenario == UiLabScenario.Library) {
            IconButton(onClick = {}) { Icon(Icons.Outlined.Add, contentDescription = "采集") }
            IconButton(onClick = { scenarioRoute = UiLabScenario.Search.route }) { Icon(Icons.Outlined.Search, contentDescription = "搜索") }
            Box {
              IconButton(onClick = { previewMoreExpanded = true }) { Icon(Icons.Outlined.MoreVert, contentDescription = "更多") }
              LibraryMoreMenu(
                expanded = previewMoreExpanded,
                onDismissRequest = { previewMoreExpanded = false },
                activeJobCount = 2,
                presentationMode = previewPresentationMode,
                onPresentationModeChange = { previewPresentationMode = it },
                themeMode = previewThemeMode,
                onThemeModeChange = { previewThemeMode = it },
                onOpenTasks = {},
                onOpenSettings = {},
                onCheckUpdate = {},
                onOpenAbout = {},
              )
            }
          } else {
            Text(scenario.route, style = MaterialTheme.typography.labelMedium, modifier = Modifier.padding(end = 16.dp))
          }
        },
      )
    },
  ) { padding ->
    Column(modifier = Modifier.fillMaxSize().padding(padding)) {
      Row(
        modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 8.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
      ) {
        UiLabScenario.entries.forEach { candidate ->
          FilterChip(
            selected = scenario == candidate,
            onClick = { scenarioRoute = candidate.route },
            label = { Text(candidate.title) },
          )
        }
      }
      when (scenario) {
        UiLabScenario.Login -> LoginScreen(submitting = false, errorMessage = null, onLogin = {})
        UiLabScenario.Library -> UiLabLibrary(previewPresentationMode, onPresentationModeChange = { previewPresentationMode = it })
        UiLabScenario.Search -> Unit
        UiLabScenario.Empty -> UiLabEmptyLibrary()
        UiLabScenario.Reader -> UiLabReader()
        UiLabScenario.Poster -> Unit
        UiLabScenario.Share -> UiLabShare()
        UiLabScenario.Tasks -> UiLabTasks()
        UiLabScenario.States -> UiLabStates()
        UiLabScenario.Settings -> UiLabSettings()
        UiLabScenario.Categories -> Unit
      }
    }
  }
}

@Composable
private fun UiLabLibrary(
  presentationMode: ArticleListPresentationMode,
  onPresentationModeChange: (ArticleListPresentationMode) -> Unit,
) {
  val isDarkAppearance = isQiankunjieDarkTheme()
  var selectedCategory by remember { mutableStateOf("全部") }
  var batchMode by remember { mutableStateOf(false) }
  var sortExpanded by remember { mutableStateOf(false) }
  var selectedSort by remember { mutableStateOf(LibrarySort.Collected) }
  var sortOrder by remember { mutableStateOf("desc") }
  var sourceExpanded by remember { mutableStateOf(false) }
  var selectedSource by remember { mutableStateOf(ArchiveSourceFilter.All) }
  val sourceOptions = listOf(ArchiveSourceFilter.All, ArchiveSourceFilter.source("少数派"), ArchiveSourceFilter.source("微信公众号"))
  val sourceCounts = mapOf("少数派" to 8, "微信公众号" to 12)
  LazyColumn(
    modifier = Modifier.fillMaxSize(),
    contentPadding = PaddingValues(16.dp),
    verticalArrangement = Arrangement.spacedBy(12.dp),
  ) {
    item {
      Row(
        modifier = Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
      ) {
        listOf("全部", "待整理", "NAS", "Docker", "编程开发").forEach { category ->
          AssistChip(
            onClick = { selectedCategory = category },
            label = { Text(category) },
            colors = AssistChipDefaults.assistChipColors(
              containerColor = if (selectedCategory == category) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surface,
            ),
          )
        }
      }
    }
    item {
      Row(
        modifier = Modifier.fillMaxWidth().height(libraryArchiveControlMetrics.toolbarHeight),
        horizontalArrangement = Arrangement.SpaceBetween,
        verticalAlignment = Alignment.CenterVertically,
      ) {
        TextButton(onClick = { batchMode = !batchMode }) {
          Icon(Icons.Outlined.TaskAlt, contentDescription = null, modifier = Modifier.size(16.dp))
          Text(if (batchMode) "已选 0" else "批量整理", modifier = Modifier.padding(start = 4.dp))
        }
        if (!batchMode) Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
        Box {
          AssistChip(
            onClick = { sortExpanded = true },
            modifier = Modifier.height(libraryControlMetrics.triggerHeight),
            colors = if (isDarkAppearance) {
              AssistChipDefaults.assistChipColors()
            } else {
              AssistChipDefaults.assistChipColors(
                containerColor = MaterialTheme.colorScheme.surface.copy(alpha = 0.62f),
                labelColor = MaterialTheme.colorScheme.onSurfaceVariant,
                leadingIconContentColor = MaterialTheme.colorScheme.onSurfaceVariant,
              )
            },
            border = if (isDarkAppearance) {
              AssistChipDefaults.assistChipBorder(enabled = true)
            } else {
              AssistChipDefaults.assistChipBorder(
                enabled = true,
                borderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.74f),
                borderWidth = 0.8.dp,
              )
            },
            label = { Text("排序") },
            leadingIcon = { Icon(Icons.AutoMirrored.Outlined.Sort, contentDescription = null, modifier = Modifier.size(18.dp)) },
          )
          LibrarySortMenu(
            expanded = sortExpanded,
            onDismissRequest = { sortExpanded = false },
            view = LibraryView.Inbox,
            selectedSort = selectedSort,
            sortOrder = sortOrder,
            onSelectSort = { selectedSort = it },
            onSelectSortOrder = { sortOrder = it },
            onReset = { selectedSort = LibrarySort.Collected; sortOrder = "desc" },
          )
        }
        Box {
          AssistChip(
            onClick = { sourceExpanded = true },
            modifier = Modifier.height(libraryControlMetrics.triggerHeight),
            colors = if (isDarkAppearance) {
              AssistChipDefaults.assistChipColors()
            } else {
              AssistChipDefaults.assistChipColors(
                containerColor = MaterialTheme.colorScheme.surface.copy(alpha = 0.62f),
                labelColor = MaterialTheme.colorScheme.onSurfaceVariant,
                leadingIconContentColor = MaterialTheme.colorScheme.onSurfaceVariant,
              )
            },
            border = if (isDarkAppearance) {
              AssistChipDefaults.assistChipBorder(enabled = true)
            } else {
              AssistChipDefaults.assistChipBorder(
                enabled = true,
                borderColor = MaterialTheme.colorScheme.outline.copy(alpha = 0.74f),
                borderWidth = 0.8.dp,
              )
            },
            label = { Text("来源") },
            leadingIcon = { Icon(Icons.Outlined.FilterList, contentDescription = null, modifier = Modifier.size(18.dp)) },
          )
          LibrarySourceMenu(
            expanded = sourceExpanded,
            onDismissRequest = { sourceExpanded = false },
            options = sourceOptions,
            selected = selectedSource,
            sourceCounts = sourceCounts,
            onSelect = { selectedSource = it },
          )
        }
        AssistChip(
          onClick = {},
          modifier = Modifier.height(libraryControlMetrics.triggerHeight),
          label = { Text("标签") },
          leadingIcon = { Icon(Icons.AutoMirrored.Outlined.Label, contentDescription = null, modifier = Modifier.size(18.dp)) },
        )
        }
      }
    }
    item {
      Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
        Text("归档资料库", style = MaterialTheme.typography.headlineSmall)
        Text("分类、批量整理和筛选集中在两行内。", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
      }
    }
    items(UiLabFixtures.library.take(1)) { article -> QiankunjieArticleCard(article = article, onOpen = {}) }
    item {
      Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text("双列视图", style = MaterialTheme.typography.titleMedium)
        Text("两列封面卡片，便于快速浏览更多文章。", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
      }
    }
    items((UiLabFixtures.library + UiLabFixtures.library.take(1)).chunked(2)) { row ->
      Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        row.forEach { article -> QiankunjieGridArticleCard(article = article, onOpen = {}, modifier = Modifier.weight(1f)) }
      }
    }
  }
}

@Composable
private fun UiLabReader() {
  val readerColorScheme = if (isQiankunjieDarkTheme()) com.idickies.storing.reader.ReaderColorScheme.Dark else com.idickies.storing.reader.ReaderColorScheme.Light
  Scaffold(
    topBar = {
      Surface(color = MaterialTheme.colorScheme.surfaceVariant) {
        Row(
          modifier = Modifier.fillMaxWidth().padding(horizontal = 22.dp, vertical = 12.dp),
          horizontalArrangement = Arrangement.SpaceBetween,
          verticalAlignment = Alignment.CenterVertically,
        ) {
          Column {
            Text("真实 WebView 阅读器", style = MaterialTheme.typography.titleSmall)
            Text("固定长文 · 图片 · 表格 · 外链约束", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
          }
          Icon(Icons.Outlined.AutoStories, contentDescription = "真实 WebView 夹具", tint = MaterialTheme.colorScheme.primary)
        }
      }
    },
    bottomBar = {
      ReaderActionBar(
        source = "微信公众号",
        originalUrl = "https://mp.weixin.qq.com/s/example",
        isFavorited = false,
        isArchived = false,
        shareEnabled = true,
        onOpenOriginal = {},
        onFavorite = {},
        onArchive = {},
        onShare = {},
      )
    },
  ) { padding ->
    AndroidView(
      factory = { context ->
        android.webkit.WebView(context).apply {
          ReaderWebView.configure(this, onOpenExternalUrl = {})
          ReaderWebView.loadCapturedHtml(this, UiLabReaderFixture.capturedHtml, readerColorScheme)
        }
      },
      modifier = Modifier.fillMaxSize().padding(padding),
    )
  }
}

@Composable
private fun UiLabSettings() {
  QiankunjieSettingsScreen(
    checkingUpdate = false,
    themeMode = ThemeMode.System,
    onThemeModeChange = {},
    onCheckUpdate = {},
    updateSource = com.idickies.storing.update.UpdateSource.Official,
    onUpdateSourceChange = {},
    onOpenReaderSettings = {},
    onOpenChangePassword = {},
    onOpenOfflineContent = {},
    onOpenMcp = {},
    onOpenCategoryManagement = {},
    onOpenAdmin = null,
    biometricAvailable = false,
    biometricEnabled = false,
    onBiometricEnabledChange = {},
    onOpenDeviceSessions = {},
    onLogout = {},
    onBack = {},
  )
}

@Composable
private fun UiLabShare() {
  LazyColumn(
    modifier = Modifier.fillMaxSize(),
    contentPadding = PaddingValues(horizontal = 22.dp, vertical = 20.dp),
    verticalArrangement = Arrangement.spacedBy(16.dp),
  ) {
    item {
      Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
        Surface(color = MaterialTheme.colorScheme.primaryContainer, shape = RoundedCornerShape(18.dp), modifier = Modifier.height(56.dp)) {
          Box(modifier = Modifier.padding(horizontal = 18.dp), contentAlignment = Alignment.Center) {
            Icon(Icons.Outlined.AddLink, contentDescription = null, tint = MaterialTheme.colorScheme.onPrimaryContainer)
          }
        }
        Column {
          Text("从其他应用采集", style = MaterialTheme.typography.headlineSmall)
          Text("网页会保存到你的收件箱", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
        }
      }
    }
    item { Text("发现 2 个网页链接", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary) }
    items(listOf("https://example.com/long-form-article", "https://example.org/another-reading")) { url ->
      val selected = url.contains("example.com")
      Card(
        modifier = Modifier.fillMaxWidth().clickable { },
        colors = CardDefaults.cardColors(containerColor = if (selected) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceContainerHigh),
      ) {
        Row(modifier = Modifier.padding(16.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
          Surface(color = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surfaceVariant, shape = CircleShape, modifier = Modifier.height(38.dp)) {
            Box(modifier = Modifier.padding(horizontal = 10.dp), contentAlignment = Alignment.Center) {
              Icon(if (selected) Icons.Outlined.CheckCircle else Icons.Outlined.Link, contentDescription = null, tint = if (selected) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.height(20.dp))
            }
          }
          Column {
            Text(if (url.contains("example.com")) "example.com" else "example.org", color = MaterialTheme.colorScheme.primary, style = MaterialTheme.typography.labelLarge)
            Text(url, modifier = Modifier.padding(top = 4.dp), maxLines = 1, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.bodySmall)
          }
        }
      }
    }
    item {
      Button(onClick = {}, modifier = Modifier.fillMaxWidth()) {
        Icon(Icons.Outlined.AddLink, contentDescription = null, modifier = Modifier.height(18.dp))
        Text("  一键采集")
      }
    }
    item { Text("仅支持公开的 HTTP / HTTPS 网页链接", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall) }
    item { Text("异常状态示例", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.error) }
    item {
      Card(colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.errorContainer)) {
        Row(modifier = Modifier.padding(14.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
          Icon(Icons.Outlined.ErrorOutline, contentDescription = null, tint = MaterialTheme.colorScheme.error)
          Text("未识别到可采集的网页链接", color = MaterialTheme.colorScheme.onErrorContainer, style = MaterialTheme.typography.bodyMedium)
        }
      }
    }
  }
}


@Composable
private fun UiLabStates() {
  LazyColumn(
    modifier = Modifier.fillMaxSize(),
    contentPadding = PaddingValues(horizontal = 22.dp, vertical = 20.dp),
    verticalArrangement = Arrangement.spacedBy(16.dp),
  ) {
    item {
      Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("正文加载骨架", style = MaterialTheme.typography.titleMedium)
        Surface(
          color = MaterialTheme.colorScheme.surface,
          shape = RoundedCornerShape(20.dp),
          modifier = Modifier.fillMaxWidth().height(440.dp),
        ) {
          ArticleDetailSkeleton()
        }
      }
    }
    item {
      Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text("状态反馈", style = MaterialTheme.typography.headlineSmall)
        Text("验证加载、空状态、错误重试与分页反馈。", color = MaterialTheme.colorScheme.onSurfaceVariant)
      }
    }
    item {
      Surface(color = MaterialTheme.colorScheme.primaryContainer, shape = RoundedCornerShape(24.dp), modifier = Modifier.fillMaxWidth()) {
        Row(modifier = Modifier.padding(18.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
          androidx.compose.material3.CircularProgressIndicator(modifier = Modifier.size(28.dp), strokeWidth = 2.5.dp)
          Column { Text("正在加载收件箱", style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.onPrimaryContainer); Text("网络恢复后会自动显示最新内容", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onPrimaryContainer) }
        }
      }
    }
    item {
      Surface(color = MaterialTheme.colorScheme.surfaceContainerHigh, shape = RoundedCornerShape(28.dp), modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) {
          Surface(color = MaterialTheme.colorScheme.primaryContainer, shape = CircleShape, modifier = Modifier.size(62.dp)) { Box(contentAlignment = Alignment.Center) { Icon(Icons.Outlined.TaskAlt, contentDescription = null, modifier = Modifier.size(30.dp), tint = MaterialTheme.colorScheme.onPrimaryContainer) } }
          Text("收件箱还是空的", style = MaterialTheme.typography.titleMedium)
          Text("从浏览器或其他应用分享网页到乾坤戒，内容会出现在这里。", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
        }
      }
    }
    item {
      Surface(color = MaterialTheme.colorScheme.errorContainer, shape = RoundedCornerShape(28.dp), modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(22.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) {
          Icon(Icons.Outlined.ErrorOutline, contentDescription = null, tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(34.dp))
          Text("暂时无法加载", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.onErrorContainer)
          Text("网络连接超时，请检查网络后重新尝试。", color = MaterialTheme.colorScheme.onErrorContainer)
          Button(onClick = {}) { Icon(Icons.Outlined.Replay, contentDescription = null, modifier = Modifier.size(18.dp)); Text("  重新尝试") }
        }
      }
    }
  }
}

@Composable
private fun UiLabTasks() {
  LazyColumn(
    modifier = Modifier.fillMaxSize(),
    contentPadding = PaddingValues(horizontal = 22.dp, vertical = 20.dp),
    verticalArrangement = Arrangement.spacedBy(14.dp),
  ) {
    item {
      Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
        Column {
          Text("采集任务", style = MaterialTheme.typography.headlineSmall)
          Text("可在后台继续跟踪采集结果", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
        }
        AssistChip(onClick = {}, label = { Text("1 进行中") }, leadingIcon = { Icon(Icons.Outlined.Sync, contentDescription = null, modifier = Modifier.height(16.dp)) })
      }
    }
    item { UiLabTaskCard("正在抓取：一篇较长的网页文章标题", "example.com/long-form", "正在采集", "正在抓取内容", UiLabTaskTone.Progress, null) }
    item { UiLabTaskCard("已完成：知识管理的长期价值", "notebook.example/article", "已保存到收件箱", "已完成", UiLabTaskTone.Success, "打开文章") }
    item { UiLabTaskCard("采集失败：页面暂时无法访问", "archive.example/unavailable", "采集失败", "抓取失败", UiLabTaskTone.Error, "重新采集") }
  }
}

private enum class UiLabTaskTone { Progress, Success, Error }

private data class UiLabTaskVisual(
  val icon: ImageVector,
  val containerColor: Color,
  val iconContainerColor: Color,
  val iconColor: Color,
)

@Composable
private fun UiLabTaskCard(title: String, url: String, status: String, stage: String, tone: UiLabTaskTone, action: String?) {
  val visual = when (tone) {
    UiLabTaskTone.Progress -> UiLabTaskVisual(Icons.Outlined.Sync, MaterialTheme.colorScheme.surfaceContainerHigh, MaterialTheme.colorScheme.primaryContainer, MaterialTheme.colorScheme.onPrimaryContainer)
    UiLabTaskTone.Success -> UiLabTaskVisual(Icons.Outlined.CheckCircle, MaterialTheme.colorScheme.secondaryContainer, MaterialTheme.colorScheme.secondary, MaterialTheme.colorScheme.onSecondary)
    UiLabTaskTone.Error -> UiLabTaskVisual(Icons.Outlined.ErrorOutline, MaterialTheme.colorScheme.errorContainer, MaterialTheme.colorScheme.error, MaterialTheme.colorScheme.onError)
  }
  Card(modifier = Modifier.fillMaxWidth(), colors = CardDefaults.cardColors(containerColor = visual.containerColor)) {
    Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
      Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.Top) {
        Surface(color = visual.iconContainerColor, shape = CircleShape, modifier = Modifier.size(42.dp)) {
          Box(contentAlignment = Alignment.Center) {
            Icon(visual.icon, contentDescription = null, tint = visual.iconColor, modifier = Modifier.size(22.dp))
          }
        }
        Column {
          Text(title, style = MaterialTheme.typography.titleSmall, maxLines = 2, overflow = TextOverflow.Ellipsis)
          Text(url, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, maxLines = 1, overflow = TextOverflow.Ellipsis)
        }
      }
      Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
        AssistChip(onClick = {}, label = { Text(status) }, leadingIcon = { Icon(visual.icon, contentDescription = null, modifier = Modifier.size(16.dp)) })
        Text(stage, style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
      }
      if (tone == UiLabTaskTone.Error) {
        Text("页面暂时无法访问，可稍后重试。", color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
      }
      action?.let { label ->
        TextButton(onClick = {}) {
          Icon(if (label == "重新采集") Icons.Outlined.Replay else Icons.AutoMirrored.Outlined.OpenInNew, contentDescription = null, modifier = Modifier.size(18.dp))
          Text("  $label")
        }
      }
    }
  }
}

@Composable
private fun UiLabEmptyLibrary() {
  Column(
    modifier = Modifier.fillMaxSize().padding(horizontal = 16.dp),
    verticalArrangement = Arrangement.Center,
  ) {
    LibraryEmptyState(view = LibraryView.Favorites, isSearchResult = false)
  }
}
