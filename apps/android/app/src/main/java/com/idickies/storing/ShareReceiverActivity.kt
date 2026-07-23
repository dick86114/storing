package com.idickies.storing

import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AddLink
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.outlined.Link
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.idickies.storing.collect.ShareCollectViewModel
import com.idickies.storing.ui.theme.QiankunjieTheme
import dagger.hilt.android.AndroidEntryPoint

/** A lightweight share target that returns to the source app immediately after queueing. */
@AndroidEntryPoint
class ShareReceiverActivity : ComponentActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val sharedText = intent?.getCharSequenceExtra(android.content.Intent.EXTRA_TEXT)?.toString().orEmpty()
    setContent {
      QiankunjieTheme {
        ShareReceiverScreen(sharedText = sharedText, onFinished = ::finish)
      }
    }
  }
}

@Composable
private fun ShareReceiverScreen(
  sharedText: String,
  onFinished: () -> Unit,
  viewModel: ShareCollectViewModel = hiltViewModel(),
) {
  val state by viewModel.state.collectAsState()
  LaunchedEffect(sharedText) { viewModel.receiveSharedText(sharedText) }
  LaunchedEffect(state.submissionAccepted) {
    if (state.submissionAccepted) onFinished()
  }

  Surface(color = MaterialTheme.colorScheme.surfaceVariant, modifier = Modifier.fillMaxSize()) {
    Column(
      modifier = Modifier.fillMaxSize().padding(horizontal = 24.dp, vertical = 72.dp),
      verticalArrangement = Arrangement.Top,
    ) {
    Row(horizontalArrangement = Arrangement.spacedBy(14.dp), verticalAlignment = Alignment.CenterVertically) {
      Surface(
        color = androidx.compose.ui.graphics.Color.Transparent,
        shape = RoundedCornerShape(22.dp),
        modifier = Modifier.size(66.dp).background(Brush.linearGradient(listOf(MaterialTheme.colorScheme.primary, MaterialTheme.colorScheme.tertiary)), RoundedCornerShape(22.dp)),
      ) { Box(contentAlignment = Alignment.Center) { Icon(Icons.Outlined.AddLink, contentDescription = null, tint = MaterialTheme.colorScheme.onPrimary, modifier = Modifier.size(30.dp)) } }
      Column {
        Text("采集到乾坤戒", style = MaterialTheme.typography.headlineSmall)
        Text("确认后会在后台保存到收件箱", color = MaterialTheme.colorScheme.onSurface, style = MaterialTheme.typography.bodyMedium)
      }
    }
    when {
      state.urls.isEmpty() -> ShareReceiverError(
        message = state.message ?: "未识别到可采集的网页链接",
        onFinished = onFinished,
      )
      else -> {
        Text("发现 ${state.urls.size} 个网页链接", style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary, modifier = Modifier.padding(top = 28.dp))
        Column(modifier = Modifier.padding(top = 12.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
          state.urls.forEach { url ->
            val selected = url == state.selectedUrl
            val host = runCatching { Uri.parse(url).host }.getOrNull().orEmpty().removePrefix("www.")
            Card(
              modifier = Modifier.fillMaxWidth().clickable { viewModel.select(url) },
              colors = CardDefaults.cardColors(containerColor = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.surface),
            ) {
              Row(modifier = Modifier.padding(14.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
                Surface(color = if (selected) MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.16f) else MaterialTheme.colorScheme.surfaceVariant, shape = CircleShape, modifier = Modifier.size(38.dp)) {
                  Box(contentAlignment = Alignment.Center) { Icon(if (selected) Icons.Outlined.CheckCircle else Icons.Outlined.Link, contentDescription = null, tint = if (selected) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.size(20.dp)) }
                }
                Column(modifier = Modifier.weight(1f)) {
                  Text(host.ifBlank { "网页链接" }, style = MaterialTheme.typography.titleSmall, color = if (selected) MaterialTheme.colorScheme.onPrimary else MaterialTheme.colorScheme.onSurface)
                  Text(url, maxLines = 1, overflow = TextOverflow.Ellipsis, color = if (selected) MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.88f) else MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 3.dp))
                }
              }
            }
          }
        }
        Text("仅支持公开的 HTTP / HTTPS 网页链接。", color = MaterialTheme.colorScheme.onSurface, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(top = 14.dp))
        state.message?.let { message ->
          Row(modifier = Modifier.padding(top = 12.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            Icon(Icons.Outlined.ErrorOutline, contentDescription = null, tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(18.dp))
            Text(message, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodyMedium)
          }
        }
        Row(modifier = Modifier.fillMaxWidth().padding(top = 26.dp), horizontalArrangement = Arrangement.spacedBy(12.dp), verticalAlignment = Alignment.CenterVertically) {
          TextButton(onClick = onFinished, modifier = Modifier.weight(1f), enabled = !state.submitting) { Text("取消", color = MaterialTheme.colorScheme.onSurfaceVariant) }
          Button(onClick = viewModel::submit, enabled = state.selectedUrl != null && !state.submitting, modifier = Modifier.weight(2f), shape = MaterialTheme.shapes.medium) {
            if (state.submitting) { CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp, color = MaterialTheme.colorScheme.onPrimary); Spacer(Modifier.size(8.dp)) }
            Icon(Icons.Outlined.AddLink, contentDescription = null, modifier = Modifier.size(18.dp))
            Spacer(Modifier.size(7.dp))
            Text(if (state.submitting) "正在提交…" else "一键采集")
          }
        }
      }
    }
    }
  }
}

@Composable
private fun ShareReceiverError(message: String, onFinished: () -> Unit) {
  Surface(
    color = MaterialTheme.colorScheme.errorContainer,
    shape = RoundedCornerShape(28.dp),
    modifier = Modifier.fillMaxWidth().padding(top = 28.dp),
  ) {
    Column(modifier = Modifier.padding(22.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(10.dp)) {
      Icon(Icons.Outlined.ErrorOutline, contentDescription = null, tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(34.dp))
      Text("无法采集这条分享", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.onErrorContainer)
      Text(message, color = MaterialTheme.colorScheme.onErrorContainer, style = MaterialTheme.typography.bodyMedium)
      TextButton(onClick = onFinished) { Text("返回原应用") }
    }
  }
}
