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
import androidx.compose.material.icons.outlined.CloudDone
import androidx.compose.material.icons.outlined.DeleteSweep
import androidx.compose.material3.Button
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
import androidx.compose.runtime.LaunchedEffect
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
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.idickies.storing.cache.CacheManager
import com.idickies.storing.offline.OfflineArticle
import com.idickies.storing.offline.OfflineDownloadManager
import com.idickies.storing.ui.components.liquidGlassSurfaceColor
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class OfflineContentUiState(
  val articles: List<OfflineArticle> = emptyList(),
  val totalSize: Long = 0L,
  val loading: Boolean = true,
)

@HiltViewModel
class OfflineContentViewModel @Inject constructor(
  private val downloadManager: OfflineDownloadManager,
) : ViewModel() {
  private val mutableState = MutableStateFlow(OfflineContentUiState())
  val state = mutableState.asStateFlow()

  init { load() }

  fun load() {
    viewModelScope.launch {
      val articles = downloadManager.all()
      val size = downloadManager.totalSize()
      mutableState.update { it.copy(articles = articles, totalSize = size, loading = false) }
    }
  }

  fun deleteArticle(articleId: Int) {
    viewModelScope.launch {
      downloadManager.delete(articleId)
      load()
    }
  }

  fun clearAll() {
    viewModelScope.launch {
      downloadManager.clearAll()
      load()
    }
  }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun OfflineContentScreen(
  onBack: () -> Unit,
  viewModel: OfflineContentViewModel = hiltViewModel(),
) {
  val state by viewModel.state.collectAsState()
  var confirmClearAll by remember { mutableStateOf(false) }

  BackHandler(onBack = onBack)

  LaunchedEffect(Unit) { viewModel.load() }

  Scaffold(
    topBar = {
      TopAppBar(
        colors = TopAppBarDefaults.topAppBarColors(containerColor = liquidGlassSurfaceColor()),
        title = { Text("离线内容") },
        navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "返回设置") } },
        actions = {
          if (state.articles.isNotEmpty()) {
            IconButton(onClick = { confirmClearAll = true }) {
              Icon(Icons.Outlined.DeleteSweep, contentDescription = "清理全部离线内容")
            }
          }
        },
      )
    },
  ) { padding ->
    Column(modifier = Modifier.fillMaxSize().padding(padding)) {
      Surface(
        color = MaterialTheme.colorScheme.primaryContainer,
        shape = MaterialTheme.shapes.medium,
        modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 12.dp),
      ) {
        Row(
          modifier = Modifier.padding(16.dp),
          horizontalArrangement = Arrangement.spacedBy(13.dp),
          verticalAlignment = Alignment.CenterVertically,
        ) {
          Icon(Icons.Outlined.CloudDone, contentDescription = null, tint = MaterialTheme.colorScheme.onPrimaryContainer, modifier = Modifier.size(24.dp))
          Column {
            Text("已下载 ${state.articles.size} 篇", style = MaterialTheme.typography.titleSmall, color = MaterialTheme.colorScheme.onPrimaryContainer)
            Text("总占用 ${CacheManager.formatSize(state.totalSize)}", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onPrimaryContainer)
          }
        }
      }

      if (state.articles.isEmpty() && !state.loading) {
        Column(
          modifier = Modifier.fillMaxSize(),
          horizontalAlignment = Alignment.CenterHorizontally,
          verticalArrangement = Arrangement.Center,
        ) {
          Text("还没有离线内容", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)
          Text("在文章详情页选择「下载离线内容」即可保存。", style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.padding(top = 4.dp))
        }
      } else {
        LazyColumn(
          contentPadding = PaddingValues(horizontal = 16.dp, vertical = 8.dp),
          verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
          items(state.articles, key = { it.articleId }) { article ->
            OfflineArticleRow(
              article = article,
              onDelete = { viewModel.deleteArticle(article.articleId) },
            )
          }
        }
      }
    }
  }

  if (confirmClearAll) {
    QiankunjieAlertDialog(
      onDismissRequest = { confirmClearAll = false },
      icon = { Icon(Icons.Outlined.DeleteSweep, contentDescription = null, tint = MaterialTheme.colorScheme.error) },
      title = { Text("清理全部离线内容？") },
      text = { Text("将删除所有已下载的离线文章，不会影响服务器上的文章。", color = MaterialTheme.colorScheme.onSurfaceVariant) },
      confirmButton = { Button(onClick = { confirmClearAll = false; viewModel.clearAll() }, colors = androidx.compose.material3.ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error, contentColor = MaterialTheme.colorScheme.onError)) { Text("全部删除") } },
      dismissButton = { TextButton(onClick = { confirmClearAll = false }) { Text("取消") } },
    )
  }
}

@Composable
private fun OfflineArticleRow(article: OfflineArticle, onDelete: () -> Unit) {
  var confirmDelete by remember { mutableStateOf(false) }
  Surface(
    color = MaterialTheme.colorScheme.surfaceVariant,
    shape = MaterialTheme.shapes.medium,
    modifier = Modifier.fillMaxWidth(),
  ) {
    Row(
      modifier = Modifier.padding(horizontal = 15.dp, vertical = 12.dp),
      horizontalArrangement = Arrangement.spacedBy(12.dp),
      verticalAlignment = Alignment.CenterVertically,
    ) {
      Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
        Text(article.title, style = MaterialTheme.typography.titleSmall, maxLines = 2, overflow = TextOverflow.Ellipsis)
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
          article.source?.let { Text(it, style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant) }
          Text("${article.imageCount} 张图片", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
          Text(CacheManager.formatSize(article.totalSizeBytes), style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
      }
      IconButton(onClick = { confirmDelete = true }) {
        Icon(Icons.Outlined.DeleteSweep, contentDescription = "删除离线内容", tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(20.dp))
      }
    }
  }
  if (confirmDelete) {
    QiankunjieAlertDialog(
      onDismissRequest = { confirmDelete = false },
      title = { Text("删除离线内容？") },
      text = { Text("仅删除本机离线副本，服务器文章不受影响。", color = MaterialTheme.colorScheme.onSurfaceVariant) },
      confirmButton = { TextButton(onClick = { confirmDelete = false; onDelete() }) { Text("删除", color = MaterialTheme.colorScheme.error) } },
      dismissButton = { TextButton(onClick = { confirmDelete = false }) { Text("取消") } },
    )
  }
}
