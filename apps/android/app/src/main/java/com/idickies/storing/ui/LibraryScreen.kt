package com.idickies.storing.ui

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
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.hilt.navigation.compose.hiltViewModel
import com.idickies.storing.collect.ShareCollectViewModel
import com.idickies.storing.library.ArticleCard
import com.idickies.storing.library.ArticleDetail
import com.idickies.storing.library.LibraryView
import com.idickies.storing.library.LibraryViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun LibraryScreen(
  sharedText: String?,
  onSharedTextConsumed: () -> Unit,
  onLogout: () -> Unit,
  libraryViewModel: LibraryViewModel = hiltViewModel(),
  collectViewModel: ShareCollectViewModel = hiltViewModel(),
) {
  val state by libraryViewModel.state.collectAsState()
  val collectState by collectViewModel.state.collectAsState()
  LaunchedEffect(sharedText) {
    if (sharedText != null) {
      collectViewModel.receiveSharedText(sharedText)
      onSharedTextConsumed()
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
          title = { Text(if (state.searchQuery.isBlank()) state.view.label else "搜索") },
          actions = { IconButton(onClick = onLogout) { Text("退出") } },
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
        onSearch = libraryViewModel::search,
        onRefresh = libraryViewModel::refresh,
        onOpen = libraryViewModel::open,
        onSelectCollectUrl = collectViewModel::select,
        onSubmitCollect = collectViewModel::submit,
        modifier = Modifier.padding(padding),
      )
    }
  }
}

@Composable
private fun LibraryList(
  state: com.idickies.storing.library.LibraryUiState,
  collectUrls: List<String>,
  collectSelectedUrl: String?,
  collectSubmitting: Boolean,
  collectMessage: String?,
  onSearch: (String) -> Unit,
  onRefresh: () -> Unit,
  onOpen: (Int) -> Unit,
  onSelectCollectUrl: (String) -> Unit,
  onSubmitCollect: () -> Unit,
  modifier: Modifier = Modifier,
) {
  var query by remember(state.searchQuery) { mutableStateOf(state.searchQuery) }
  LazyColumn(
    modifier = modifier.fillMaxSize(),
    contentPadding = PaddingValues(16.dp),
    verticalArrangement = Arrangement.spacedBy(10.dp),
  ) {
    item {
      OutlinedTextField(
        value = query,
        onValueChange = { query = it; onSearch(it) },
        modifier = Modifier.fillMaxWidth(),
        label = { Text("搜索标题、来源、摘要或标签") },
        singleLine = true,
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
    if (state.loading || state.refreshing) item { FullPageLoading("正在加载${state.view.label}…") }
    if (state.error != null) item { ErrorPage(state.error, onRefresh) }
    if (!state.loading && state.error == null && state.articles.isEmpty()) item { Text("这里还没有文章。你可以从其他应用分享链接到乾坤戒。", modifier = Modifier.padding(vertical = 48.dp), color = MaterialTheme.colorScheme.onSurfaceVariant) }
    items(state.articles, key = { it.id }) { article -> ArticleCardItem(article, onOpen) }
  }
}

@Composable
private fun ArticleCardItem(article: ArticleCard, onOpen: (Int) -> Unit) {
  Card(modifier = Modifier.fillMaxWidth().clickable { onOpen(article.id) }) {
    Column(Modifier.padding(16.dp)) {
      Text(article.displayTitle, style = MaterialTheme.typography.titleMedium)
      listOfNotNull(article.source, article.author).takeIf { it.isNotEmpty() }?.let { Text(it.joinToString(" · "), color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 4.dp)) }
      article.aiSummary?.takeIf { it.isNotBlank() }?.let { Text(it, maxLines = 3, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 8.dp)) }
      Row(Modifier.padding(top = 10.dp)) {
        if (article.isFavorited) Text("收藏", color = MaterialTheme.colorScheme.primary)
        if (article.isArchived) Text("归档", color = MaterialTheme.colorScheme.secondary, modifier = Modifier.padding(start = 10.dp))
      }
    }
  }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ArticleReader(article: ArticleDetail, onBack: () -> Unit, onFavorite: () -> Unit, onArchive: () -> Unit, onDelete: () -> Unit) {
  var confirmDelete by remember { mutableStateOf(false) }
  BackHandler(onBack = onBack)
  Scaffold(topBar = { TopAppBar(title = { Text(article.displayTitle, maxLines = 1) }, navigationIcon = { IconButton(onClick = onBack) { Text("返回") } }) }) { padding ->
    LazyColumn(modifier = Modifier.fillMaxSize().padding(padding), contentPadding = PaddingValues(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
      item { Text(article.displayTitle, style = MaterialTheme.typography.headlineSmall) }
      item { listOfNotNull(article.source, article.author).takeIf { it.isNotEmpty() }?.let { Text(it.joinToString(" · "), color = MaterialTheme.colorScheme.onSurfaceVariant) } }
      item { Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) { Button(onClick = onFavorite) { Text(if (article.isFavorited) "取消收藏" else "收藏") }; Button(onClick = onArchive) { Text(if (article.isArchived) "移回收件箱" else "归档") }; Button(onClick = { confirmDelete = true }) { Text("删除") } } }
      article.aiSummary?.takeIf { it.isNotBlank() }?.let { item { Card { Column(Modifier.padding(14.dp)) { Text("AI 摘要", style = MaterialTheme.typography.titleSmall); Text(it, modifier = Modifier.padding(top = 8.dp)) } } } }
      item { HorizontalDivider() }
      item { ReaderBody(article) }
    }
  }
  if (confirmDelete) AlertDialog(onDismissRequest = { confirmDelete = false }, title = { Text("删除文章？") }, text = { Text("此操作会从你的资料库删除该文章。") }, confirmButton = { Button(onClick = { confirmDelete = false; onDelete() }) { Text("删除") } }, dismissButton = { Button(onClick = { confirmDelete = false }) { Text("取消") } })
}

@Composable
private fun ReaderBody(article: ArticleDetail) {
  val context = LocalContext.current
  val html = article.contentHtml
  if (!html.isNullOrBlank()) {
    AndroidView(factory = {
      WebView(it).apply {
        settings.javaScriptEnabled = false
        settings.allowFileAccess = false
        settings.allowContentAccess = false
        settings.domStorageEnabled = false
        webViewClient = object : WebViewClient() {
          override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
            val uri = request?.url ?: return true
            if (uri.scheme == "http" || uri.scheme == "https") context.startActivity(Intent(Intent.ACTION_VIEW, uri))
            return true
          }
        }
        loadDataWithBaseURL("https://storing.idickies.com", html, "text/html", "UTF-8", null)
      }
    }, modifier = Modifier.fillMaxWidth().height(640.dp))
  } else {
    Text(article.contentMd?.takeIf { it.isNotBlank() } ?: "正文暂时不可用", style = MaterialTheme.typography.bodyLarge)
  }
}

@Composable
private fun FullPageLoading(message: String) = Column(Modifier.fillMaxWidth().padding(32.dp), horizontalAlignment = Alignment.CenterHorizontally) { CircularProgressIndicator(Modifier.size(28.dp)); Text(message, modifier = Modifier.padding(top = 12.dp)) }

@Composable
private fun ErrorPage(message: String, retry: () -> Unit) = Column(Modifier.fillMaxWidth().padding(32.dp), horizontalAlignment = Alignment.CenterHorizontally) { Text(message, color = MaterialTheme.colorScheme.error); Button(onClick = retry, modifier = Modifier.padding(top = 12.dp)) { Text("重试") } }
