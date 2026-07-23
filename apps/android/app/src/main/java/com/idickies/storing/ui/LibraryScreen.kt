package com.idickies.storing.ui

import android.content.ClipboardManager
import android.content.Intent
import android.net.Uri
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
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
import androidx.compose.material.icons.outlined.ContentPaste
import androidx.compose.material.icons.outlined.DeleteSweep
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.automirrored.outlined.OpenInNew
import androidx.compose.material.icons.outlined.DeleteOutline
import androidx.compose.material.icons.outlined.Favorite
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material.icons.outlined.IosShare
import androidx.compose.material.icons.outlined.Link
import androidx.compose.material.icons.automirrored.outlined.Logout
import androidx.compose.material.icons.outlined.Inventory2
import androidx.compose.material.icons.outlined.Inbox
import androidx.compose.material.icons.outlined.MoreHoriz
import androidx.compose.material.icons.outlined.MoreVert
import androidx.compose.material.icons.outlined.MoveToInbox
import androidx.compose.material.icons.outlined.Replay
import androidx.compose.material.icons.outlined.Sync
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
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.TextButton
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
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
import com.idickies.storing.library.ArticleCard
import com.idickies.storing.library.ArticleDetail
import com.idickies.storing.network.MobileCollectJob
import com.idickies.storing.library.LibraryView
import com.idickies.storing.library.LibraryViewModel
import com.idickies.storing.reader.ReaderDocument
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
  var showActions by remember { mutableStateOf(false) }
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
            IconButton(onClick = { showActions = true }) {
              Icon(Icons.Outlined.MoreHoriz, contentDescription = "更多操作")
            }
          },
        )
      },
      bottomBar = {
        NavigationBar {
          LibraryView.entries.forEach { item ->
            NavigationBarItem(
              selected = state.view == item && state.searchQuery.isBlank(),
              onClick = { libraryViewModel.select(item) },
              icon = {
                when (item) {
                  LibraryView.Inbox -> Icon(Icons.Outlined.Inbox, contentDescription = item.label)
                  LibraryView.Favorites -> Icon(Icons.Outlined.StarBorder, contentDescription = item.label)
                  LibraryView.Archive -> Icon(Icons.Outlined.Inventory2, contentDescription = item.label)
                }
              },
              label = { Text(item.label) },
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
  if (showActions) AppActionsDialog(
    checkingUpdate = updateChecking,
    onDismiss = { showActions = false },
    onCheckUpdate = { onManualUpdateCheck(); showActions = false },
    onLogout = { showActions = false; onLogout() },
  )
  if (showManualCollect) ManualCollectDialog(onDismiss = { showManualCollect = false }, viewModel = collectViewModel)
}

@Composable
private fun AppActionsDialog(
  checkingUpdate: Boolean,
  onDismiss: () -> Unit,
  onCheckUpdate: () -> Unit,
  onLogout: () -> Unit,
) {
  AlertDialog(
    onDismissRequest = onDismiss,
    icon = { Icon(Icons.Outlined.MoreHoriz, contentDescription = null, tint = MaterialTheme.colorScheme.primary) },
    title = { Text("更多操作") },
    text = {
      Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
        Surface(color = MaterialTheme.colorScheme.surfaceContainerHigh, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth().clickable(enabled = !checkingUpdate, onClick = onCheckUpdate)) {
          Row(modifier = Modifier.padding(14.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Outlined.Sync, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
            Column { Text(if (checkingUpdate) "正在检查更新…" else "手动检查更新", style = MaterialTheme.typography.titleSmall); Text("立即检查 GitHub Release 中是否有新版本", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall) }
          }
        }
        Surface(color = MaterialTheme.colorScheme.errorContainer, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth().clickable(onClick = onLogout)) {
          Row(modifier = Modifier.padding(14.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.AutoMirrored.Outlined.Logout, contentDescription = null, tint = MaterialTheme.colorScheme.error)
            Column { Text("退出当前设备", style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.onErrorContainer); Text("清除当前设备上的登录会话", color = MaterialTheme.colorScheme.onErrorContainer, style = MaterialTheme.typography.bodySmall) }
          }
        }
      }
    },
    confirmButton = { TextButton(onClick = onDismiss) { Text("关闭") } },
  )
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
        singleLine = true,
      )
    }
    if (activeJobCount > 0) item {
      Card(modifier = Modifier.fillMaxWidth().clickable(onClick = onOpenTasks)) {
        Column(Modifier.padding(14.dp)) {
          Text("正在采集 $activeJobCount 条内容", style = MaterialTheme.typography.titleSmall)
          Text("点击查看实时任务状态", modifier = Modifier.padding(top = 4.dp), color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
      }
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
    if (!state.loading && !state.searchPending && state.error == null && state.articles.isEmpty()) item { Text("这里还没有文章。你可以从其他应用分享链接到乾坤戒。", modifier = Modifier.padding(vertical = 48.dp), color = MaterialTheme.colorScheme.onSurfaceVariant) }
    items(state.articles, key = { it.id }) { article -> QiankunjieArticleCard(article, onOpen) }
      if (state.articles.isNotEmpty() && !state.fromCache) item {
        Column(modifier = Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally) {
          when {
            state.loadingMore -> FullPageLoading("正在加载更多文章…")
            state.loadMoreError != null -> {
              Text(state.loadMoreError, color = MaterialTheme.colorScheme.error)
              Button(onClick = onLoadMore, modifier = Modifier.padding(top = 8.dp)) { Text("重试加载更多") }
            }
            state.hasMore -> Button(onClick = onLoadMore) { Text("加载更多") }
            else -> Text("已加载全部文章", color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(vertical = 12.dp))
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
        title = {
          Column {
            Text(article.source ?: "乾坤戒阅读", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
            Text("阅读", style = MaterialTheme.typography.titleMedium)
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
      Surface(tonalElevation = 3.dp) {
        Row(
          modifier = Modifier.fillMaxWidth().padding(horizontal = 28.dp, vertical = 8.dp),
          horizontalArrangement = Arrangement.SpaceEvenly,
        ) {
          IconButton(onClick = onFavorite) { Icon(if (article.isFavorited) Icons.Outlined.Favorite else Icons.Outlined.FavoriteBorder, contentDescription = if (article.isFavorited) "取消收藏" else "收藏") }
          IconButton(onClick = onArchive) { Icon(if (article.isArchived) Icons.Outlined.MoveToInbox else Icons.Outlined.Archive, contentDescription = if (article.isArchived) "移回收件箱" else "归档") }
          IconButton(onClick = ::shareOriginalUrl, enabled = !article.originalUrl.isNullOrBlank()) { Icon(Icons.Outlined.IosShare, contentDescription = "分享原网页") }
        }
      }
    },
  ) { padding ->
    val html = article.contentHtml
    if (!html.isNullOrBlank()) {
      AndroidView(
        factory = { webContext ->
          WebView(webContext).apply {
            settings.javaScriptEnabled = false
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            settings.domStorageEnabled = false
            settings.loadWithOverviewMode = false
            settings.useWideViewPort = false
            webViewClient = object : WebViewClient() {
              override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val uri = request?.url ?: return true
                if (uri.scheme == "http" || uri.scheme == "https") webContext.startActivity(Intent(Intent.ACTION_VIEW, uri))
                return true
              }
            }
            loadDataWithBaseURL("https://storing.idickies.com", ReaderDocument.forWebView(html), "text/html", "UTF-8", null)
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
    title = { Text("删除文章？") },
    text = { Text("此操作会从你的资料库删除该文章。") },
    confirmButton = { Button(onClick = { confirmDelete = false; onDelete() }) { Text("删除") } },
    dismissButton = { TextButton(onClick = { confirmDelete = false }) { Text("取消") } },
  )
}

@Composable
private fun FullPageLoading(message: String) = Column(Modifier.fillMaxWidth().padding(32.dp), horizontalAlignment = Alignment.CenterHorizontally) { CircularProgressIndicator(Modifier.size(28.dp)); Text(message, modifier = Modifier.padding(top = 12.dp)) }

@Composable
private fun ErrorPage(message: String, retry: () -> Unit) = Column(Modifier.fillMaxWidth().padding(32.dp), horizontalAlignment = Alignment.CenterHorizontally) { Text(message, color = MaterialTheme.colorScheme.error); Button(onClick = retry, modifier = Modifier.padding(top = 12.dp)) { Text("重试") } }
