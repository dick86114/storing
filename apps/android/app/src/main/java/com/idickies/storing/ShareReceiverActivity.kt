package com.idickies.storing

import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
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

  Column(
    modifier = Modifier.fillMaxSize().padding(24.dp),
    verticalArrangement = Arrangement.Center,
  ) {
    Text("采集到乾坤戒", style = MaterialTheme.typography.headlineSmall)
    Text("确认后将异步采集网页内容。", modifier = Modifier.padding(top = 8.dp), color = MaterialTheme.colorScheme.onSurfaceVariant)
    when {
      state.urls.isEmpty() -> {
        Text(state.message ?: "未识别到可采集的网页链接", modifier = Modifier.padding(top = 24.dp), color = MaterialTheme.colorScheme.error)
        OutlinedButton(onClick = onFinished, modifier = Modifier.padding(top = 20.dp)) { Text("返回") }
      }
      else -> {
        Card(modifier = Modifier.fillMaxWidth().padding(top = 24.dp)) {
          Column(modifier = Modifier.padding(16.dp)) {
            state.urls.forEach { url ->
              val selected = url == state.selectedUrl
              val host = runCatching { Uri.parse(url).host }.getOrNull().orEmpty()
              Column(
                modifier = Modifier.fillMaxWidth().clickable { viewModel.select(url) }.padding(vertical = 8.dp),
              ) {
                Text(if (selected) "✓ ${host.ifBlank { "网页链接" }}" else host.ifBlank { "网页链接" }, color = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface)
                Text(url, maxLines = 2, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
              }
            }
          }
        }
        state.message?.let { Text(it, modifier = Modifier.padding(top = 12.dp), color = MaterialTheme.colorScheme.error) }
        Row(modifier = Modifier.fillMaxWidth().padding(top = 24.dp), horizontalArrangement = Arrangement.End, verticalAlignment = Alignment.CenterVertically) {
          OutlinedButton(onClick = onFinished) { Text("取消") }
          Button(
            onClick = viewModel::submit,
            enabled = state.selectedUrl != null && !state.submitting,
            modifier = Modifier.padding(start = 12.dp),
          ) { Text(if (state.submitting) "提交中…" else "一键采集") }
        }
      }
    }
  }
}
