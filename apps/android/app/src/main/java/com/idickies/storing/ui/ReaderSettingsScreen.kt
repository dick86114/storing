package com.idickies.storing.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.FormatLineSpacing
import androidx.compose.material.icons.outlined.FormatSize
import androidx.compose.material.icons.outlined.WidthNormal
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.idickies.storing.reader.ReaderPreferencesViewModel
import com.idickies.storing.ui.components.liquidGlassSurfaceColor

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ReaderSettingsScreen(
  onBack: () -> Unit,
  viewModel: ReaderPreferencesViewModel = hiltViewModel(),
) {
  val preferences by viewModel.preferences.collectAsState()
  BackHandler(onBack = onBack)
  Scaffold(
    topBar = {
      TopAppBar(
        colors = TopAppBarDefaults.topAppBarColors(containerColor = liquidGlassSurfaceColor()),
        title = { Text("阅读设置") },
        navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "返回设置") } },
      )
    },
  ) { padding ->
    LazyColumn(
      modifier = Modifier.fillMaxSize().padding(padding),
      contentPadding = PaddingValues(horizontal = 16.dp, vertical = 18.dp),
      verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
      item {
        Surface(color = MaterialTheme.colorScheme.primaryContainer, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth()) {
          Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text("只影响本机阅读器", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.onPrimaryContainer)
            Text("不会修改文章原文、服务端内容或公开页面。", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onPrimaryContainer)
          }
        }
      }
      item {
        ReaderPreferenceGroup(
          icon = Icons.Outlined.FormatSize,
          title = "字号",
          detail = "调整正文文字大小",
          options = listOf(90 to "小", 100 to "标准", 110 to "大", 125 to "特大"),
          selected = preferences.textZoomPercent,
          onSelect = viewModel::updateTextZoom,
        )
      }
      item {
        ReaderPreferenceGroup(
          icon = Icons.Outlined.FormatLineSpacing,
          title = "行距",
          detail = "调整长文段落间的呼吸感",
          options = listOf(1.6f to "紧凑", 1.8f to "标准", 2.0f to "舒适"),
          selected = preferences.lineHeight,
          onSelect = viewModel::updateLineHeight,
        )
      }
      item {
        ReaderPreferenceGroup(
          icon = Icons.Outlined.WidthNormal,
          title = "页面边距",
          detail = "调整正文左右留白",
          options = listOf(14 to "窄", 18 to "标准", 28 to "宽"),
          selected = preferences.horizontalPaddingPx,
          onSelect = viewModel::updateHorizontalPadding,
        )
      }
    }
  }
}

@Composable
private fun <T> ReaderPreferenceGroup(
  icon: androidx.compose.ui.graphics.vector.ImageVector,
  title: String,
  detail: String,
  options: List<Pair<T, String>>,
  selected: T,
  onSelect: (T) -> Unit,
) {
  Surface(color = MaterialTheme.colorScheme.surfaceVariant, shape = MaterialTheme.shapes.medium, modifier = Modifier.fillMaxWidth()) {
    Column(modifier = Modifier.padding(15.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
      androidx.compose.foundation.layout.Row(horizontalArrangement = Arrangement.spacedBy(13.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(22.dp))
        Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
          Text(title, style = MaterialTheme.typography.titleSmall)
          Text(detail, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
      }
      FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        options.forEach { (value, label) ->
          FilterChip(
            selected = value == selected,
            onClick = { onSelect(value) },
            label = { Text(label) },
            leadingIcon = if (value == selected) { { Icon(Icons.Outlined.CheckCircle, contentDescription = null, modifier = Modifier.size(16.dp)) } } else null,
          )
        }
      }
    }
  }
}
