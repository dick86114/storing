package com.idickies.storing.ui

import android.content.ClipboardManager
import android.content.Intent
import android.net.Uri
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AddLink
import androidx.compose.material.icons.outlined.Archive
import androidx.compose.material.icons.outlined.BatterySaver
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Clear
import androidx.compose.material.icons.outlined.ContentPaste
import androidx.compose.material.icons.outlined.DeleteSweep
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.OpenInNew
import androidx.compose.material.icons.outlined.DeleteOutline
import androidx.compose.material.icons.outlined.Favorite
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material.icons.outlined.FilterList
import androidx.compose.material.icons.outlined.IosShare
import androidx.compose.material.icons.outlined.Link
import androidx.compose.material.icons.automirrored.outlined.Logout
import androidx.compose.material.icons.outlined.Inventory2
import androidx.compose.material.icons.outlined.Inbox
import androidx.compose.material.icons.outlined.MoreVert
import androidx.compose.material.icons.outlined.MoveToInbox
import androidx.compose.material.icons.outlined.Replay
import androidx.compose.material.icons.outlined.Sync
import androidx.compose.material.icons.automirrored.outlined.Sort
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material.icons.outlined.Settings
import androidx.compose.material.icons.outlined.StarBorder
import androidx.compose.material.icons.outlined.TaskAlt
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.AssistChip
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Badge
import androidx.compose.material3.BadgedBox
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.TextButton
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.compose.ui.unit.dp
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.viewinterop.AndroidView
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import com.idickies.storing.collect.CollectJobsViewModel
import com.idickies.storing.collect.ShareCollectViewModel
import com.idickies.storing.ui.components.ActiveCollectJobsCard
import com.idickies.storing.ui.components.ReaderActionBar
import com.idickies.storing.ui.components.CompactBottomBarItem
import com.idickies.storing.ui.components.QiankunjieCompactBottomBar
import com.idickies.storing.ui.components.QiankunjieGlassPanel
import com.idickies.storing.ui.components.liquidGlassSurfaceColor
import com.idickies.storing.library.ArticleCard
import com.idickies.storing.library.ArticleDetail
import com.idickies.storing.library.ArchiveSourceFilter
import com.idickies.storing.network.MobileCollectJob
import com.idickies.storing.library.LibraryView
import com.idickies.storing.library.LibrarySort
import com.idickies.storing.library.LibraryViewModel
import com.idickies.storing.library.archiveSourceFilters
import com.idickies.storing.reader.ReaderWebView
import com.idickies.storing.settings.BatteryOptimizationGuidance
import com.idickies.storing.ui.components.QiankunjieArticleCard

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LibraryScreen(
  sharedText: String?,
  onSharedTextConsumed: () -> Unit,
  openArticleId: Int?,
  onArticleOpened: () -> Unit,
  openCollectJobs: Boolean,
  onCollectJobsOpened: () -> Unit,
  onManualUpdateCheck: () -> Unit,
  updateChecking: Boolean,
  onLogout: () -> Unit,
  libraryViewModel: LibraryViewModel = hiltViewModel(),
  collectViewModel: ShareCollectViewModel = hiltViewModel(),
  jobsViewModel: CollectJobsViewModel = hiltViewModel(),
) {
  val state by libraryViewModel.state.collectAsState()
  val collectState by collectViewModel.state.collectAsState()
  val jobsState by jobsViewModel.state.collectAsState()
  val lifecycleOwner = LocalLifecycleOwner.current
  var showTasks by remember { mutableStateOf(false) }
  var showManualCollect by remember { mutableStateOf(false) }
  var showBatteryGuidance by remember { mutableStateOf(false) }
  var showSettings by remember { mutableStateOf(false) }
  DisposableEffect(lifecycleOwner) {
    val observer = LifecycleEventObserver { _, event ->
      when (event) {
        Lifecycle.Event.ON_START -> jobsViewModel.start()
        Lifecycle.Event.ON_STOP -> jobsViewModel.stop()
        else -> Unit
      }
    }
    lifecycleOwner.lifecycle.addObserver(observer)
    if (lifecycleOwner.lifecycle.currentState.isAtLeast(Lifecycle.State.STARTED)) jobsViewModel.start()
    onDispose {
      lifecycleOwner.lifecycle.removeObserver(observer)
      jobsViewModel.stop()
    }
  }
  LaunchedEffect(Unit) { collectViewModel.resumePendingSubmissions() }
  LaunchedEffect(sharedText) {
    if (sharedText != null) {
      collectViewModel.receiveSharedText(sharedText)
      onSharedTextConsumed()
    }
  }
  LaunchedEffect(openArticleId) {
    if (openArticleId != null) {
      libraryViewModel.open(openArticleId)
      onArticleOpened()
    }
  }
  LaunchedEffect(openCollectJobs) {
    if (openCollectJobs) {
      showTasks = true
      onCollectJobsOpened()
    }
  }

  val detail = state.detail
  val detailError = state.detailError
  when {
    showSettings -> QiankunjieSettingsScreen(
      checkingUpdate = updateChecking,
      onCheckUpdate = onManualUpdateCheck,
      onOpenBatteryGuidance = { showSettings = false; showBatteryGuidance = true },
      onLogout = onLogout,
      onBack = { showSettings = false },
    )
    detail != null -> ArticleReader(
      article = detail,
      onBack = libraryViewModel::closeDetail,
      onFavorite = { libraryViewModel.toggleFavorite(detail) },
      onArchive = { libraryViewModel.toggleArchive(detail) },
      onDelete = { libraryViewModel.delete(detail) },
    )
    state.loadingDetail -> FullPageLoading("正在加载文章…")
    detailError != null -> ErrorPage(detailError, libraryViewModel::closeDetail)
    else -> Scaffold(
      topBar = {
        TopAppBar(
          colors = TopAppBarDefaults.topAppBarColors(containerColor = liquidGlassSurfaceColor()),
          title = {
            Column {
              Text("乾坤戒", style = MaterialTheme.typography.titleLarge)
              Text(if (state.searchQuery.isBlank()) state.view.label else "搜索结果", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
          },
          actions = {
            IconButton(onClick = { showManualCollect = true }) {
              Icon(Icons.Outlined.AddLink, contentDescription = "手动采集链接")
            }
            IconButton(onClick = { showTasks = true }) {
              BadgedBox(badge = { if (jobsState.activeJobCount > 0) Badge { Text(jobsState.activeJobCount.toString()) } }) {
                Icon(Icons.Outlined.TaskAlt, contentDescription = "采集任务")
              }
            }
            IconButton(onClick = { showSettings = true }) {
              Icon(Icons.Outlined.Settings, contentDescription = "设置与更新")
            }
          },
        )
      },
      bottomBar = {
        QiankunjieCompactBottomBar {
          LibraryView.entries.forEach { item ->
            CompactBottomBarItem(
              label = item.label,
              icon = when (item) {
                LibraryView.Inbox -> Icons.Outlined.Inbox
                LibraryView.Favorites -> Icons.Outlined.StarBorder
                LibraryView.Archive -> Icons.Outlined.Inventory2
              },
              selected = state.view == item && state.searchQuery.isBlank(),
              onClick = { libraryViewModel.select(item) },
            )
          }
        }
      },
    ) { padding ->
      LibraryList(
        state = state,
        collectUrls = collectState.urls,
        collectSelectedUrl = collectState.selectedUrl,
        collectSubmitting = collectState.submitting,
        collectMessage = collectState.message,
        activeJobCount = jobsState.activeJobCount,
        onOpenTasks = { showTasks = true },
        onSearch = libraryViewModel::search,
        onSort = libraryViewModel::selectSort,
        onArchiveSource = libraryViewModel::selectArchiveSource,
        onRefresh = libraryViewModel::refresh,
        onLoadMore = libraryViewModel::loadMore,
        onOpen = libraryViewModel::open,
        onSelectCollectUrl = collectViewModel::select,
        onSubmitCollect = collectViewModel::submit,
        modifier = Modifier.padding(padding),
      )
    }
  }

  if (showTasks) CollectJobsDialog(
    onDismiss = { showTasks = false },
    onOpenArticle = { id -> showTasks = false; libraryViewModel.open(id) },
    onOpenBatteryGuidance = { showTasks = false; showBatteryGuidance = true },
    viewModel = jobsViewModel,
  )
  if (showBatteryGuidance) BatteryOptimizationDialog(onDismiss = { showBatteryGuidance = false })
  if (showManualCollect) ManualCollectDialog(onDismiss = { showManualCollect = false }, viewModel = collectViewModel)
}

@Composable
private fun ManualCollectDialog(
  onDismiss: () -> Unit,
  viewModel: ShareCollectViewModel,
) {
  val state by viewModel.state.collectAsState()
  val context = LocalContext.current
  var url by rememberSaveable { mutableStateOf("") }
  val messageColor = if (state.submissionAccepted) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error
  AlertDialog(
    onDismissRequest = onDismiss,
    icon = { Icon(Icons.Outlined.Link, contentDescription = null, tint = MaterialTheme.colorScheme.primary) },
    title = { Text("采集网页链接") },
    text = {
      Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        Text("粘贴公开的 HTTP 或 HTTPS 网页，乾坤戒会将它保存到收件箱。", color = MaterialTheme.colorScheme.onSurfaceVariant)
        OutlinedTextField(
          value = url,
          onValueChange = { url = it },
          label = { Text("网页链接") },
          leadingIcon = { Icon(Icons.Outlined.Link, contentDescription = null) },
          trailingIcon = {
            IconButton(onClick = {
              val clipboard = context.getSystemService(ClipboardManager::class.java)
              url = clipboard?.primaryClip?.getItemAt(0)?.coerceToText(context)?.toString().orEmpty()
            }) { Icon(Icons.Outlined.ContentPaste, contentDescription = "从剪贴板粘贴") }
          },
          modifier = Modifier.fillMaxWidth(),
          shape = MaterialTheme.shapes.medium,
          singleLine = true,
        )
        state.message?.let { message ->
          Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Icon(
              if (state.submissionAccepted) Icons.Outlined.CheckCircle else Icons.Outlined.ErrorOutline,
              contentDescription = null,
              tint = messageColor,
            )
            Text(message, color = messageColor, style = MaterialTheme.typography.bodyMedium)
          }
        }
      }
    },
    confirmButton = {
      Button(onClick = { viewModel.submitManual(url) }, enabled = !state.submitting) {
        Icon(Icons.Outlined.AddLink, contentDescription = null, modifier = Modifier.size(18.dp))
        Spacer(Modifier.size(8.dp))
        Text(if (state.submitting) "正在提交…" else "一键采集")
      }
    },
    dismissButton = { TextButton(onClick = onDismiss) { Text("关闭") } },
  )
}

@Composable
private fun CollectJobsDialog(
  onDismiss: () -> Unit,
  onOpenArticle: (Int) -> Unit,
  onOpenBatteryGuidance: () -> Unit,
  viewModel: CollectJobsViewModel,
) {
  val state by viewModel.state.collectAsState()
  AlertDialog(
    onDismissRequest = onDismiss,
    icon = { Icon(Icons.Outlined.Sync, contentDescription = null, tint = MaterialTheme.colorScheme.primary) },
    title = {
      Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("采集任务")
        if (state.activeJobCount > 0) AssistChip(onClick = {}, label = { Text("${state.activeJobCount} 进行中") })
      }
    },
    text = {
      when {
        state.loading -> FullPageLoading("正在加载任务…")
        state.error != null && state.jobs.isEmpty() -> state.error?.let { Text(it, color = MaterialTheme.colorScheme.error) }
        state.jobs.isEmpty() -> EmptyCollectJobs()
        else -> LazyColumn(modifier = Modifier.height(340.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
          items(state.jobs, key = { it.id }) { job ->
            CollectJobCard(job = job, onRetry = { viewModel.retry(job.id) }, onOpenArticle = { job.articleId?.let(onOpenArticle) })
          }
        }
      }
    },
    confirmButton = {
      TextButton(onClick = { viewModel.clearFinished() }, enabled = state.jobs.any { it.isTerminal }) {
        Icon(Icons.Outlined.DeleteSweep, contentDescription = null, modifier = Modifier.size(18.dp))
        Spacer(Modifier.size(6.dp))
        Text("清理已完成")
      }
    },
    dismissButton = {
      Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        TextButton(onClick = onOpenBatteryGuidance) { Text("后台说明") }
        Button(onClick = onDismiss) { Text("关闭") }
      }
    },
  )
}

@Composable
private fun EmptyCollectJobs() {
  Column(
    modifier = Modifier.fillMaxWidth().padding(vertical = 18.dp),
    horizontalAlignment = Alignment.CenterHorizontally,
    verticalArrangement = Arrangement.spacedBy(8.dp),
  ) {
    Icon(Icons.Outlined.TaskAlt, contentDescription = null, modifier = Modifier.size(36.dp), tint = MaterialTheme.colorScheme.primary)
    Text("还没有来自 Android 的采集任务", style = MaterialTheme.typography.titleSmall)
    Text("从浏览器或其他应用分享网页后，进度会显示在这里。", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
  }
}

@Composable
private fun CollectJobCard(
  job: MobileCollectJob,
  onRetry: () -> Unit,
  onOpenArticle: () -> Unit,
) {
  val status = collectJobStatusPresentation(job.status)
  Card(
    modifier = Modifier.fillMaxWidth(),
    colors = CardDefaults.cardColors(containerColor = status.containerColor()),
  ) {
    Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
      Row(horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.Top) {
        Surface(color = status.iconContainerColor(), shape = androidx.compose.foundation.shape.CircleShape, modifier = Modifier.size(42.dp)) {
          Box(contentAlignment = Alignment.Center) {
            Icon(status.icon, contentDescription = null, tint = status.iconColor(), modifier = Modifier.size(22.dp))
          }
        }
        Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
          Text(job.title ?: job.normalizedUrl, style = MaterialTheme.typography.titleSmall, maxLines = 2, overflow = TextOverflow.Ellipsis)
          Text(job.normalizedUrl, style = MaterialTheme.typography.bodySmall, maxLines = 1, overflow = TextOverflow.Ellipsis, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
      }
      Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
        AssistChip(onClick = {}, label = { Text(status.label) }, leadingIcon = { Icon(status.icon, contentDescription = null, modifier = Modifier.size(16.dp)) })
        Text(collectStageLabel(job.stage), style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
      }
      job.errorSummary?.let { error ->
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.Top) {
          Icon(Icons.Outlined.ErrorOutline, contentDescription = null, modifier = Modifier.size(18.dp), tint = MaterialTheme.colorScheme.error)
          Text(error, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
        }
      }
      if (job.status == "failed" || job.articleId != null) {
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.fillMaxWidth()) {
          if (job.status == "failed") {
            TextButton(onClick = onRetry) {
              Icon(Icons.Outlined.Replay, contentDescription = null, modifier = Modifier.size(18.dp))
              Spacer(Modifier.size(5.dp))
              Text("重新采集")
            }
          }
          if (job.articleId != null) {
            TextButton(onClick = onOpenArticle) {
              Icon(Icons.AutoMirrored.Outlined.OpenInNew, contentDescription = null, modifier = Modifier.size(18.dp))
              Spacer(Modifier.size(5.dp))
              Text("打开文章")
            }
          }
        }
      }
    }
  }
}

private data class CollectJobStatusPresentation(
  val label: String,
  val icon: ImageVector,
  val tone: CollectJobTone,
) {
  @Composable fun containerColor() = when (tone) {
    CollectJobTone.Progress -> MaterialTheme.colorScheme.surfaceContainerHigh
    CollectJobTone.Success -> MaterialTheme.colorScheme.secondaryContainer
    CollectJobTone.Error -> MaterialTheme.colorScheme.errorContainer
  }

  @Composable fun iconContainerColor() = when (tone) {
    CollectJobTone.Progress -> MaterialTheme.colorScheme.primaryContainer
    CollectJobTone.Success -> MaterialTheme.colorScheme.secondary
    CollectJobTone.Error -> MaterialTheme.colorScheme.error
  }

  @Composable fun iconColor() = when (tone) {
    CollectJobTone.Progress -> MaterialTheme.colorScheme.onPrimaryContainer
    CollectJobTone.Success -> MaterialTheme.colorScheme.onSecondary
    CollectJobTone.Error -> MaterialTheme.colorScheme.onError
  }
}

private enum class CollectJobTone { Progress, Success, Error }

private fun collectJobStatusPresentation(status: String): CollectJobStatusPresentation = when (status) {
  "completed" -> CollectJobStatusPresentation("已保存到收件箱", Icons.Outlined.CheckCircle, CollectJobTone.Success)
  "failed" -> CollectJobStatusPresentation("采集失败", Icons.Outlined.ErrorOutline, CollectJobTone.Error)
  else -> CollectJobStatusPresentation("正在采集", Icons.Outlined.Sync, CollectJobTone.Progress)
}

private fun collectStageLabel(stage: String): String = when (stage.lowercase()) {
  "queued" -> "等待开始"
  "capture", "capturing" -> "正在抓取内容"
  "processing" -> "正在整理文章"
  "summarizing", "summary" -> "正在生成摘要"
  "completed", "done" -> "已完成"
  else -> stage.ifBlank { "等待处理" }
}

@Composable
private fun BatteryOptimizationDialog(onDismiss: () -> Unit) {
  val guidance = BatteryOptimizationGuidance.forManufacturer(android.os.Build.MANUFACTURER)
  AlertDialog(
    onDismissRequest = onDismiss,
    icon = { Icon(Icons.Outlined.BatterySaver, contentDescription = null, tint = MaterialTheme.colorScheme.primary) },
    title = { Text(guidance.title) },
    text = { Column(verticalArrangement = Arrangement.spacedBy(12.dp)) { Text("为了让采集结果在锁屏或切后台后继续同步，请按下面步骤检查系统设置。", color = MaterialTheme.colorScheme.onSurfaceVariant); guidance.steps.forEachIndexed { index, step -> Row(horizontalArrangement = Arrangement.spacedBy(10.dp), verticalAlignment = Alignment.Top) { Surface(color = MaterialTheme.colorScheme.primaryContainer, shape = androidx.compose.foundation.shape.CircleShape, modifier = Modifier.size(24.dp)) { Box(contentAlignment = Alignment.Center) { Text((index + 1).toString(), color = MaterialTheme.colorScheme.onPrimaryContainer, style = MaterialTheme.typography.labelMedium) } }; Text(step, modifier = Modifier.weight(1f)) } } } },
    confirmButton = { Button(onClick = onDismiss) { Text("知道了") } },
  )
}

@Composable
@OptIn(ExperimentalMaterial3Api::class)
private fun LibraryList(
  state: com.idickies.storing.library.LibraryUiState,
  collectUrls: List<String>,
  collectSelectedUrl: String?,
  collectSubmitting: Boolean,
  collectMessage: String?,
  activeJobCount: Int,
  onOpenTasks: () -> Unit,
  onSearch: (String) -> Unit,
  onSort: (LibrarySort) -> Unit,
  onArchiveSource: (ArchiveSourceFilter) -> Unit,
  onRefresh: () -> Unit,
  onLoadMore: () -> Unit,
  onOpen: (Int) -> Unit,
  onSelectCollectUrl: (String) -> Unit,
  onSubmitCollect: () -> Unit,
  modifier: Modifier = Modifier,
) {
  var query by remember(state.searchQuery) { mutableStateOf(state.searchQuery) }
  PullToRefreshBox(
    isRefreshing = state.refreshing,
    onRefresh = onRefresh,
    modifier = modifier.fillMaxSize(),
  ) {
    LazyColumn(
      modifier = Modifier.fillMaxSize(),
      contentPadding = PaddingValues(16.dp),
      verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
    item {
      Column(modifier = Modifier.padding(top = 4.dp)) {
        Text("把值得阅读的内容，留在自己的知识空间。", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
        Text("${state.view.label} · ${state.articles.size} 篇", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary, modifier = Modifier.padding(top = 6.dp))
      }
    }
    item {
      OutlinedTextField(
        value = query,
        onValueChange = { query = it; onSearch(it) },
        modifier = Modifier.fillMaxWidth(),
        label = { Text("搜索标题、来源、摘要或标签") },
        leadingIcon = { Icon(Icons.Outlined.Search, contentDescription = "搜索") },
        trailingIcon = if (query.isNotBlank()) {
          { IconButton(onClick = { query = ""; onSearch("") }) { Icon(Icons.Outlined.Clear, contentDescription = "清空搜索") } }
        } else null,
        shape = MaterialTheme.shapes.medium,
        singleLine = true,
      )
    }
    if (state.searchQuery.isBlank()) item {
      var sortExpanded by remember { mutableStateOf(false) }
      var sourceExpanded by remember { mutableStateOf(false) }
      val sourceOptions = archiveSourceFilters(state.archiveSources)
      val sourceCounts = state.archiveSources.associate { it.source to it.count }
      Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
        Box {
          AssistChip(
            onClick = { sortExpanded = true },
            label = { Text(state.sort.label) },
            leadingIcon = { Icon(Icons.AutoMirrored.Outlined.Sort, contentDescription = "排序方式", modifier = Modifier.size(18.dp)) },
          )
          DropdownMenu(expanded = sortExpanded, onDismissRequest = { sortExpanded = false }) {
            LibrarySort.availableFor(state.view).forEach { sort ->
              DropdownMenuItem(
                text = { Text(sort.label) },
                leadingIcon = { if (sort == state.sort) Icon(Icons.Outlined.CheckCircle, contentDescription = null) },
                onClick = { sortExpanded = false; onSort(sort) },
              )
            }
          }
        }
        if (ArchiveSourceFilter.isAvailableFor(state.view, state.searchQuery)) {
          Box {
            AssistChip(
              onClick = { sourceExpanded = true },
              label = { Text(if (state.archiveSourcesLoading) "加载来源…" else state.archiveSource.label) },
              leadingIcon = { Icon(Icons.Outlined.FilterList, contentDescription = "归档来源", modifier = Modifier.size(18.dp)) },
            )
            DropdownMenu(expanded = sourceExpanded, onDismissRequest = { sourceExpanded = false }) {
              sourceOptions.forEach { filter ->
                val count = filter.category?.let(sourceCounts::get)
                DropdownMenuItem(
                  text = { Text(if (count == null) filter.label else "${filter.label} · $count") },
                  leadingIcon = { if (filter == state.archiveSource) Icon(Icons.Outlined.CheckCircle, contentDescription = null) },
                  onClick = { sourceExpanded = false; onArchiveSource(filter) },
                )
              }
            }
          }
        }
      }
    }
    if (activeJobCount > 0) item {
      ActiveCollectJobsCard(
        activeJobCount = activeJobCount,
        onOpenTasks = onOpenTasks,
      )
    }
    if (collectUrls.isNotEmpty()) {
      item {
        Card { Column(Modifier.padding(16.dp)) {
          Text("分享采集", style = MaterialTheme.typography.titleMedium)
          collectUrls.forEach { url -> Text(if (url == collectSelectedUrl) "✓ $url" else url, modifier = Modifier.fillMaxWidth().clickable { onSelectCollectUrl(url) }.padding(top = 8.dp), maxLines = 1) }
          Button(onClick = onSubmitCollect, enabled = collectSelectedUrl != null && !collectSubmitting, modifier = Modifier.padding(top = 12.dp)) { Text(if (collectSubmitting) "提交中…" else "一键采集") }
          if (collectMessage != null) Text(collectMessage, modifier = Modifier.padding(top = 8.dp))
        } }
      }
    }
    if (state.fromCache) item { Text("当前显示离线缓存，联网后可点刷新获取最新内容。", color = MaterialTheme.colorScheme.onSurfaceVariant) }
    if (state.loading || state.refreshing || state.searchPending) item { FullPageLoading(if (state.searchPending) "正在准备搜索…" else "正在加载${state.view.label}…") }
    if (state.error != null) item { ErrorPage(state.error, onRefresh) }
    if (!state.loading && !state.searchPending && state.error == null && state.articles.isEmpty()) item { LibraryEmptyState(view = state.view, isSearchResult = state.searchQuery.isNotBlank()) }
    items(state.articles, key = { it.id }) { article -> QiankunjieArticleCard(article, onOpen) }
      if (state.articles.isNotEmpty() && !state.fromCache) item {
        Column(modifier = Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
          when {
            state.loadingMore -> InlineLoading("正在加载更多文章…")
            state.loadMoreError != null -> InlineLoadMoreError(message = state.loadMoreError, retry = onLoadMore)
            state.hasMore -> TextButton(onClick = onLoadMore) { Icon(Icons.Outlined.Sync, contentDescription = null, modifier = Modifier.size(18.dp)); Spacer(Modifier.size(6.dp)); Text("加载更多") }
            else -> Text("你已经看到全部文章了", color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(vertical = 12.dp), style = MaterialTheme.typography.bodySmall)
          }
        }
      }
    }
  }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ArticleReader(article: ArticleDetail, onBack: () -> Unit, onFavorite: () -> Unit, onArchive: () -> Unit, onDelete: () -> Unit) {
  val context = LocalContext.current
  var confirmDelete by remember { mutableStateOf(false) }
  var moreExpanded by remember { mutableStateOf(false) }
  BackHandler(onBack = onBack)
  fun shareOriginalUrl() {
    article.originalUrl?.let { url ->
      context.startActivity(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, url))
    }
  }
  Scaffold(
    topBar = {
      TopAppBar(
        colors = TopAppBarDefaults.topAppBarColors(containerColor = liquidGlassSurfaceColor()),
        title = {
          Column {
            Text(article.source ?: "乾坤戒阅读", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
            Text(article.displayTitle, style = MaterialTheme.typography.titleMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
          }
        },
        navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "返回资料库") } },
        actions = {
          IconButton(
            onClick = { article.originalUrl?.let { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(it))) } },
            enabled = !article.originalUrl.isNullOrBlank(),
          ) { Icon(Icons.AutoMirrored.Outlined.OpenInNew, contentDescription = "打开原网页") }
          Box {
            IconButton(onClick = { moreExpanded = true }) { Icon(Icons.Outlined.MoreVert, contentDescription = "更多阅读操作") }
            DropdownMenu(expanded = moreExpanded, onDismissRequest = { moreExpanded = false }) {
              DropdownMenuItem(
                text = { Text("分享原网页") },
                onClick = { moreExpanded = false; shareOriginalUrl() },
                leadingIcon = { Icon(Icons.Outlined.IosShare, contentDescription = null) },
                enabled = !article.originalUrl.isNullOrBlank(),
              )
              DropdownMenuItem(
                text = { Text(if (article.isFavorited) "取消收藏" else "收藏") },
                onClick = { moreExpanded = false; onFavorite() },
                leadingIcon = { Icon(if (article.isFavorited) Icons.Outlined.Favorite else Icons.Outlined.FavoriteBorder, contentDescription = null) },
              )
              DropdownMenuItem(
                text = { Text(if (article.isArchived) "移回收件箱" else "归档") },
                onClick = { moreExpanded = false; onArchive() },
                leadingIcon = { Icon(if (article.isArchived) Icons.Outlined.MoveToInbox else Icons.Outlined.Archive, contentDescription = null) },
              )
              DropdownMenuItem(
                text = { Text("删除", color = MaterialTheme.colorScheme.error) },
                onClick = { moreExpanded = false; confirmDelete = true },
                leadingIcon = { Icon(Icons.Outlined.DeleteOutline, contentDescription = null, tint = MaterialTheme.colorScheme.error) },
              )
            }
          }
        },
      )
    },
    bottomBar = {
      ReaderActionBar(
        isFavorited = article.isFavorited,
        isArchived = article.isArchived,
        shareEnabled = !article.originalUrl.isNullOrBlank(),
        onFavorite = onFavorite,
        onArchive = onArchive,
        onShare = ::shareOriginalUrl,
      )
    },
  ) { padding ->
    val html = article.contentHtml
    if (!html.isNullOrBlank()) {
      AndroidView(
        factory = { webContext ->
          android.webkit.WebView(webContext).apply {
            ReaderWebView.configure(this) { uri -> webContext.startActivity(Intent(Intent.ACTION_VIEW, uri)) }
            ReaderWebView.loadCapturedHtml(this, html)
          }
        },
        modifier = Modifier.fillMaxSize().padding(padding),
      )
    } else {
      LazyColumn(
        modifier = Modifier.fillMaxSize().padding(padding),
        contentPadding = PaddingValues(horizontal = 22.dp, vertical = 18.dp),
        verticalArrangement = Arrangement.spacedBy(18.dp),
      ) {
        item {
          Text(article.source ?: "已保存文章", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary)
          Text(article.displayTitle, style = MaterialTheme.typography.headlineMedium, modifier = Modifier.padding(top = 8.dp))
        }
        article.aiSummary?.takeIf { it.isNotBlank() }?.let { summary ->
          item {
            Card(colors = androidx.compose.material3.CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.primaryContainer)) {
              Column(Modifier.padding(18.dp)) {
                Text("AI 摘要", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.onPrimaryContainer)
                Text(summary, modifier = Modifier.padding(top = 8.dp), style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onPrimaryContainer)
              }
            }
          }
        }
        item { Text(article.contentMd?.takeIf { it.isNotBlank() } ?: "正文暂时不可用", style = MaterialTheme.typography.bodyLarge) }
      }
    }
  }
  if (confirmDelete) AlertDialog(
    onDismissRequest = { confirmDelete = false },
    icon = { Icon(Icons.Outlined.DeleteOutline, contentDescription = null, tint = MaterialTheme.colorScheme.error) },
    title = { Text("从资料库删除？") },
    text = {
      Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Text(article.displayTitle, style = MaterialTheme.typography.titleSmall, maxLines = 2, overflow = TextOverflow.Ellipsis)
        Text("删除后将不再显示在你的资料库中；此操作不会影响原网页。", color = MaterialTheme.colorScheme.onSurfaceVariant)
      }
    },
    confirmButton = { Button(onClick = { confirmDelete = false; onDelete() }, colors = androidx.compose.material3.ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error, contentColor = MaterialTheme.colorScheme.onError)) { Text("确认删除") } },
    dismissButton = { TextButton(onClick = { confirmDelete = false }) { Text("保留文章") } },
  )
}

@Composable
private fun LibraryEmptyState(view: LibraryView, isSearchResult: Boolean) {
  val (icon, title, message) = if (isSearchResult) {
    Triple(Icons.Outlined.ErrorOutline, "没有匹配的文章", "试试更短的关键词，或切换到其他资料库。")
  } else when (view) {
    LibraryView.Inbox -> Triple(Icons.Outlined.Inbox, "收件箱还是空的", "从浏览器、微信或其他应用分享网页到乾坤戒，内容会出现在这里。")
    LibraryView.Favorites -> Triple(Icons.Outlined.StarBorder, "还没有收藏", "在阅读器中点按收藏图标，就能把文章留在这里。")
    LibraryView.Archive -> Triple(Icons.Outlined.Inventory2, "归档资料库为空", "归档后的文章会被整理到这里，随时可以移回收件箱。")
  }
  Column(
    modifier = Modifier.fillMaxWidth().padding(vertical = 44.dp, horizontal = 24.dp),
    horizontalAlignment = Alignment.CenterHorizontally,
    verticalArrangement = Arrangement.spacedBy(10.dp),
  ) {
    Surface(color = MaterialTheme.colorScheme.primaryContainer, shape = androidx.compose.foundation.shape.CircleShape, modifier = Modifier.size(68.dp)) {
      Box(contentAlignment = Alignment.Center) { Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.onPrimaryContainer, modifier = Modifier.size(32.dp)) }
    }
    Text(title, style = MaterialTheme.typography.titleMedium)
    Text(message, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium, modifier = Modifier.fillMaxWidth())
  }
}

@Composable
private fun FullPageLoading(message: String) = Column(
  Modifier.fillMaxWidth().padding(vertical = 32.dp, horizontal = 24.dp),
  horizontalAlignment = Alignment.CenterHorizontally,
  verticalArrangement = Arrangement.spacedBy(12.dp),
) {
  Surface(color = MaterialTheme.colorScheme.primaryContainer, shape = androidx.compose.foundation.shape.CircleShape, modifier = Modifier.size(58.dp)) {
    Box(contentAlignment = Alignment.Center) { CircularProgressIndicator(Modifier.size(26.dp), strokeWidth = 2.5.dp, color = MaterialTheme.colorScheme.primary) }
  }
  Text(message, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
}

@Composable
private fun InlineLoading(message: String) = Row(
  modifier = Modifier.padding(vertical = 16.dp),
  horizontalArrangement = Arrangement.spacedBy(10.dp),
  verticalAlignment = Alignment.CenterVertically,
) {
  CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
  Text(message, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
}

@Composable
private fun InlineLoadMoreError(message: String, retry: () -> Unit) = Column(
  horizontalAlignment = Alignment.CenterHorizontally,
  verticalArrangement = Arrangement.spacedBy(6.dp),
) {
  Text(message, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
  TextButton(onClick = retry) { Icon(Icons.Outlined.Replay, contentDescription = null, modifier = Modifier.size(18.dp)); Spacer(Modifier.size(6.dp)); Text("重试加载更多") }
}

@Composable
private fun ErrorPage(message: String, retry: () -> Unit) = Surface(
  modifier = Modifier.fillMaxWidth().padding(vertical = 28.dp, horizontal = 4.dp),
  color = MaterialTheme.colorScheme.errorContainer,
  shape = MaterialTheme.shapes.large,
) {
  Column(
    modifier = Modifier.padding(22.dp),
    horizontalAlignment = Alignment.CenterHorizontally,
    verticalArrangement = Arrangement.spacedBy(10.dp),
  ) {
    Icon(Icons.Outlined.ErrorOutline, contentDescription = null, tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(34.dp))
    Text("暂时无法加载", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.onErrorContainer)
    Text(message, color = MaterialTheme.colorScheme.onErrorContainer, style = MaterialTheme.typography.bodyMedium)
    Button(onClick = retry) { Icon(Icons.Outlined.Replay, contentDescription = null, modifier = Modifier.size(18.dp)); Spacer(Modifier.size(6.dp)); Text("重新尝试") }
  }
}
