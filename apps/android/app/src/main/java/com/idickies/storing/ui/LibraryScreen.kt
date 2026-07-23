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
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
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
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.compose.LocalLifecycleOwner
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.LifecycleEventObserver
import com.idickies.storing.collect.CollectJobsViewModel
import com.idickies.storing.collect.ShareCollectViewModel
import com.idickies.storing.library.ArticleCard
import com.idickies.storing.library.ArticleDetail
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
            IconButton(onClick = { showManualCollect = true }) { Text("采集") }
            IconButton(onClick = { showTasks = true }) { Text(if (jobsState.activeJobCount > 0) "任务${jobsState.activeJobCount}" else "任务") }
            IconButton(onClick = { showActions = true }) { Text("更多") }
          },
        )
      },
      bottomBar = {
        NavigationBar {
          LibraryView.entries.forEach { item ->
            NavigationBarItem(
              selected = state.view == item && state.searchQuery.isBlank(),
              onClick = { libraryViewModel.select(item) },
              icon = { Text(if (item == LibraryView.Inbox) "收" else if (item == LibraryView.Favorites) "藏" else "档") },
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
    title = { Text("更多操作") },
    text = {
      Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        TextButton(onClick = onCheckUpdate, enabled = !checkingUpdate, modifier = Modifier.fillMaxWidth()) { Text(if (checkingUpdate) "正在检查更新…" else "手动检查更新") }
        TextButton(onClick = onLogout, modifier = Modifier.fillMaxWidth()) { Text("退出当前设备") }
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
  AlertDialog(
    onDismissRequest = onDismiss,
    title = { Text("采集链接") },
    text = { Column {
      OutlinedTextField(
        value = url,
        onValueChange = { url = it },
        label = { Text("网页链接") },
        modifier = Modifier.fillMaxWidth(),
        singleLine = true,
      )
      Button(
        onClick = {
          val clipboard = context.getSystemService(ClipboardManager::class.java)
          url = clipboard?.primaryClip?.getItemAt(0)?.coerceToText(context)?.toString().orEmpty()
        },
        modifier = Modifier.padding(top = 8.dp),
      ) { Text("从剪贴板粘贴") }
      state.message?.let { Text(it, modifier = Modifier.padding(top = 8.dp), color = MaterialTheme.colorScheme.onSurfaceVariant) }
    } },
    confirmButton = { Button(onClick = { viewModel.submitManual(url) }, enabled = !state.submitting) { Text(if (state.submitting) "提交中…" else "一键采集") } },
    dismissButton = { Button(onClick = onDismiss) { Text("关闭") } },
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
    title = { Text("采集任务") },
    text = {
      if (state.loading) FullPageLoading("正在加载任务…")
      else LazyColumn(modifier = Modifier.height(360.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        if (state.jobs.isEmpty()) item { Text("还没有来自 Android 的采集任务。") }
        items(state.jobs, key = { it.id }) { job ->
          Card { Column(Modifier.padding(12.dp)) {
            Text(job.title ?: job.normalizedUrl, style = MaterialTheme.typography.titleSmall, maxLines = 2)
            Text("${job.status} · ${job.stage}", color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 4.dp))
            job.errorSummary?.let { Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(top = 4.dp)) }
            Row(modifier = Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
              if (job.status == "failed") Button(onClick = { viewModel.retry(job.id) }) { Text("重试") }
              if (job.articleId != null) Button(onClick = { onOpenArticle(job.articleId) }) { Text("打开文章") }
            }
          } }
        }
      }
    },
    confirmButton = { Button(onClick = { viewModel.clearFinished() }) { Text("清理已完成") } },
    dismissButton = { Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { TextButton(onClick = onOpenBatteryGuidance) { Text("后台说明") }; Button(onClick = onDismiss) { Text("关闭") } } },
  )
}

@Composable
private fun BatteryOptimizationDialog(onDismiss: () -> Unit) {
  val guidance = BatteryOptimizationGuidance.forManufacturer(android.os.Build.MANUFACTURER)
  AlertDialog(
    onDismissRequest = onDismiss,
    title = { Text(guidance.title) },
    text = { Column(verticalArrangement = Arrangement.spacedBy(10.dp)) { guidance.steps.forEachIndexed { index, step -> Text("${index + 1}. $step") } } },
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
  BackHandler(onBack = onBack)
  Scaffold(topBar = {
    TopAppBar(
      title = { Text(article.displayTitle, maxLines = 1) },
      navigationIcon = { IconButton(onClick = onBack) { Text("返回") } },
      actions = {
        IconButton(
          onClick = { article.originalUrl?.let { context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(it))) } },
          enabled = !article.originalUrl.isNullOrBlank(),
        ) { Text("原文") }
        IconButton(
          onClick = {
            article.originalUrl?.let { url ->
              context.startActivity(Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT, url))
            }
          },
          enabled = !article.originalUrl.isNullOrBlank(),
        ) { Text("分享") }
        IconButton(onClick = onFavorite) { Text(if (article.isFavorited) "藏✓" else "收藏") }
        IconButton(onClick = onArchive) { Text(if (article.isArchived) "收件箱" else "归档") }
        IconButton(onClick = { confirmDelete = true }) { Text("删除") }
      },
    )
  }) { padding ->
    val html = article.contentHtml
    if (!html.isNullOrBlank()) {
      AndroidView(
        factory = { context ->
          WebView(context).apply {
            settings.javaScriptEnabled = false
            settings.allowFileAccess = false
            settings.allowContentAccess = false
            settings.domStorageEnabled = false
            settings.loadWithOverviewMode = false
            settings.useWideViewPort = false
            webViewClient = object : WebViewClient() {
              override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
                val uri = request?.url ?: return true
                if (uri.scheme == "http" || uri.scheme == "https") context.startActivity(Intent(Intent.ACTION_VIEW, uri))
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
        contentPadding = PaddingValues(16.dp),
      ) {
        item { Text(article.displayTitle, style = MaterialTheme.typography.titleLarge) }
        article.aiSummary?.takeIf { it.isNotBlank() }?.let { summary ->
          item { Card(modifier = Modifier.padding(top = 12.dp)) { Column(Modifier.padding(14.dp)) { Text("AI 摘要", style = MaterialTheme.typography.titleSmall); Text(summary, modifier = Modifier.padding(top = 8.dp)) } } }
        }
        item { Text(article.contentMd?.takeIf { it.isNotBlank() } ?: "正文暂时不可用", modifier = Modifier.padding(top = 16.dp), style = MaterialTheme.typography.bodyLarge) }
      }
    }
  }
  if (confirmDelete) AlertDialog(
    onDismissRequest = { confirmDelete = false },
    title = { Text("删除文章？") },
    text = { Text("此操作会从你的资料库删除该文章。") },
    confirmButton = { Button(onClick = { confirmDelete = false; onDelete() }) { Text("删除") } },
    dismissButton = { Button(onClick = { confirmDelete = false }) { Text("取消") } },
  )
}

@Composable
private fun FullPageLoading(message: String) = Column(Modifier.fillMaxWidth().padding(32.dp), horizontalAlignment = Alignment.CenterHorizontally) { CircularProgressIndicator(Modifier.size(28.dp)); Text(message, modifier = Modifier.padding(top = 12.dp)) }

@Composable
private fun ErrorPage(message: String, retry: () -> Unit) = Column(Modifier.fillMaxWidth().padding(32.dp), horizontalAlignment = Alignment.CenterHorizontally) { Text(message, color = MaterialTheme.colorScheme.error); Button(onClick = retry, modifier = Modifier.padding(top = 12.dp)) { Text("重试") } }
