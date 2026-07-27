package com.idickies.storing

import android.net.Uri
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateDpAsState
import androidx.compose.animation.core.tween
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.scaleIn
import androidx.compose.animation.scaleOut
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AddLink
import androidx.compose.material.icons.outlined.Check
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.outlined.Link
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
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
import androidx.compose.ui.draw.scale
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

  Surface(color = MaterialTheme.colorScheme.surface, modifier = Modifier.fillMaxSize()) {
    Column(
      modifier = Modifier
        .fillMaxSize()
        .statusBarsPadding()
        .navigationBarsPadding()
        .padding(horizontal = 20.dp, vertical = 20.dp),
    ) {
      ShareReceiverHeader()
      Spacer(Modifier.size(24.dp))
      AnimatedContent(
        targetState = state.urls.isNotEmpty(),
        transitionSpec = { fadeIn(tween(180)) + scaleIn(initialScale = 0.98f) togetherWith fadeOut(tween(100)) + scaleOut(targetScale = 0.98f) },
        label = "shareReceiverContent",
        modifier = Modifier.weight(1f),
      ) { hasUrls ->
        if (hasUrls) {
          ShareReceiverUrlSelection(
            urls = state.urls,
            selectedUrl = state.selectedUrl,
            message = state.message,
            onSelect = viewModel::select,
          )
        } else {
          ShareReceiverError(
            message = state.message ?: "未识别到可采集的网页链接",
            onFinished = onFinished,
          )
        }
      }
      AnimatedVisibility(
        visible = state.urls.isNotEmpty(),
        enter = fadeIn(tween(180)) + scaleIn(initialScale = 0.97f),
        exit = fadeOut(tween(90)) + scaleOut(targetScale = 0.97f),
      ) {
        ShareReceiverActions(
          submitting = state.submitting,
          selectedUrl = state.selectedUrl,
          onCancel = onFinished,
          onSubmit = viewModel::submit,
        )
      }
    }
  }
}

@Composable
private fun ShareReceiverHeader() {
  Row(
    horizontalArrangement = Arrangement.spacedBy(14.dp),
    verticalAlignment = Alignment.CenterVertically,
  ) {
    Surface(
      color = MaterialTheme.colorScheme.primaryContainer,
      contentColor = MaterialTheme.colorScheme.onPrimaryContainer,
      shape = RoundedCornerShape(20.dp),
      modifier = Modifier.size(60.dp),
    ) {
      Box(contentAlignment = Alignment.Center) {
        Icon(Icons.Outlined.AddLink, contentDescription = null, modifier = Modifier.size(28.dp))
      }
    }
    Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
      Text("一键采集", style = MaterialTheme.typography.headlineSmall)
      Text(
        "保存网页到你的收件箱",
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        style = MaterialTheme.typography.bodyMedium,
      )
    }
  }
}

@Composable
private fun ShareReceiverUrlSelection(
  urls: List<String>,
  selectedUrl: String?,
  message: String?,
  onSelect: (String) -> Unit,
) {
  Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
    Text(
      if (urls.size == 1) "确认要保存的网页" else "选择要保存的网页（${urls.size} 个）",
      style = MaterialTheme.typography.titleSmall,
    )
    Text(
      "采集完成后可在收件箱中阅读、归档或生成摘要。",
      style = MaterialTheme.typography.bodyMedium,
      color = MaterialTheme.colorScheme.onSurfaceVariant,
    )
    Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
      urls.forEach { url ->
        ShareReceiverUrlCard(
          url = url,
          selected = url == selectedUrl,
          onClick = { onSelect(url) },
        )
      }
    }
    message?.let {
      Row(
        modifier = Modifier.padding(top = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
        verticalAlignment = Alignment.CenterVertically,
      ) {
        Icon(Icons.Outlined.ErrorOutline, contentDescription = null, tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(18.dp))
        Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
      }
    }
  }
}

@Composable
private fun ShareReceiverUrlCard(url: String, selected: Boolean, onClick: () -> Unit) {
  val containerColor by animateColorAsState(
    targetValue = if (selected) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceVariant,
    label = "shareReceiverCardColor",
  )
  val contentColor by animateColorAsState(
    targetValue = if (selected) MaterialTheme.colorScheme.onPrimaryContainer else MaterialTheme.colorScheme.onSurface,
    label = "shareReceiverCardContent",
  )
  val borderColor by animateColorAsState(
    targetValue = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.outlineVariant,
    label = "shareReceiverCardBorder",
  )
  val elevation by animateDpAsState(targetValue = if (selected) 3.dp else 0.dp, label = "shareReceiverCardElevation")
  val host = runCatching { Uri.parse(url).host }.getOrNull().orEmpty().removePrefix("www.")

  Card(
    modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
    shape = RoundedCornerShape(18.dp),
    colors = CardDefaults.cardColors(containerColor = containerColor, contentColor = contentColor),
    border = BorderStroke(1.dp, borderColor),
    elevation = CardDefaults.cardElevation(defaultElevation = elevation),
  ) {
    Row(
      modifier = Modifier.padding(horizontal = 14.dp, vertical = 13.dp),
      horizontalArrangement = Arrangement.spacedBy(12.dp),
      verticalAlignment = Alignment.CenterVertically,
    ) {
      Surface(
        color = if (selected) MaterialTheme.colorScheme.primary.copy(alpha = 0.16f) else MaterialTheme.colorScheme.surface,
        shape = CircleShape,
        modifier = Modifier.size(36.dp),
      ) {
        Box(contentAlignment = Alignment.Center) {
          Icon(
            if (selected) Icons.Outlined.Check else Icons.Outlined.Link,
            contentDescription = null,
            tint = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(20.dp),
          )
        }
      }
      Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
        Text(host.ifBlank { "网页链接" }, style = MaterialTheme.typography.titleSmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
        Text(url, style = MaterialTheme.typography.bodySmall, color = contentColor.copy(alpha = 0.72f), maxLines = 2, overflow = TextOverflow.Ellipsis)
      }
      if (selected) {
        Icon(Icons.Outlined.CheckCircle, contentDescription = "已选择", tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(21.dp))
      }
    }
  }
}

@Composable
private fun ShareReceiverActions(
  submitting: Boolean,
  selectedUrl: String?,
  onCancel: () -> Unit,
  onSubmit: () -> Unit,
) {
  Surface(
    color = MaterialTheme.colorScheme.surface,
    tonalElevation = 2.dp,
    shape = RoundedCornerShape(22.dp),
    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
    modifier = Modifier.fillMaxWidth(),
  ) {
    Row(
      modifier = Modifier.padding(12.dp),
      horizontalArrangement = Arrangement.spacedBy(10.dp),
      verticalAlignment = Alignment.CenterVertically,
    ) {
      TextButton(onClick = onCancel, enabled = !submitting, modifier = Modifier.weight(0.78f)) {
        Icon(Icons.Outlined.Close, contentDescription = null, modifier = Modifier.size(18.dp))
        Spacer(Modifier.size(5.dp))
        Text("取消")
      }
      Button(
        onClick = onSubmit,
        enabled = selectedUrl != null && !submitting,
        modifier = Modifier.weight(1.22f),
        shape = RoundedCornerShape(14.dp),
      ) {
        AnimatedContent(
          targetState = submitting,
          transitionSpec = { fadeIn(tween(100)) togetherWith fadeOut(tween(80)) },
          label = "shareReceiverSubmit",
        ) { isSubmitting ->
          Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
            if (isSubmitting) {
              CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp, color = MaterialTheme.colorScheme.onPrimary)
              Text("正在提交…")
            } else {
              Icon(Icons.Outlined.AddLink, contentDescription = null, modifier = Modifier.size(18.dp))
              Text("一键采集")
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
    shape = RoundedCornerShape(24.dp),
    modifier = Modifier.fillMaxWidth(),
  ) {
    Column(
      modifier = Modifier.padding(22.dp),
      horizontalAlignment = Alignment.CenterHorizontally,
      verticalArrangement = Arrangement.spacedBy(10.dp),
    ) {
      Icon(Icons.Outlined.ErrorOutline, contentDescription = null, tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(34.dp))
      Text("无法采集这条分享", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.onErrorContainer)
      Text(message, color = MaterialTheme.colorScheme.onErrorContainer, style = MaterialTheme.typography.bodyMedium)
      TextButton(onClick = onFinished) { Text("返回原应用") }
    }
  }
}
