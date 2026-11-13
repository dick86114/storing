package com.idickies.storing.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.idickies.storing.library.DeepAnalysisReport

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DeepAnalysisSheet(
  report: DeepAnalysisReport?,
  statusText: String,
  offline: Boolean,
  onDismiss: () -> Unit,
  onGenerate: () -> Unit,
  onRetry: () -> Unit,
  onShowHistory: () -> Unit,
) {
  ModalBottomSheet(onDismissRequest = onDismiss) {
    Column(
      modifier = Modifier
        .fillMaxWidth()
        .padding(horizontal = 16.dp, vertical = 12.dp),
      verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
      Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Text("深度报告", style = MaterialTheme.typography.titleLarge)
        Text(statusText, style = MaterialTheme.typography.labelLarge, color = MaterialTheme.colorScheme.primary)
      }
      if (offline) {
        Text("当前离线，已显示缓存报告；重新生成需要网络连接。", style = MaterialTheme.typography.bodySmall)
      }
      report?.let { value ->
        Text("一段看懂", style = MaterialTheme.typography.titleMedium)
        Text(value.executiveSummary, style = MaterialTheme.typography.bodyMedium)
        Text("核心论点", style = MaterialTheme.typography.titleMedium)
        value.coreArguments.forEach { Text("${it.claim}：${it.evidence}", style = MaterialTheme.typography.bodyMedium) }
        Text("论证链路", style = MaterialTheme.typography.titleMedium)
        value.reasoningChain.forEach { Text(it, style = MaterialTheme.typography.bodyMedium) }
        Text("关键信息与数据", style = MaterialTheme.typography.titleMedium)
        value.keyFacts.forEach { Text(it.fact, style = MaterialTheme.typography.bodyMedium) }
        Text("不同观点", style = MaterialTheme.typography.titleMedium)
        value.viewpoints.forEach { Text("${it.summary}：${it.reasoning}", style = MaterialTheme.typography.bodyMedium) }
        Text("风险与局限", style = MaterialTheme.typography.titleMedium)
        value.risks.forEach { Text(it, style = MaterialTheme.typography.bodyMedium) }
        Text("行动指引", style = MaterialTheme.typography.titleMedium)
        value.actions.forEach { Text("${it.action}（${it.condition}）", style = MaterialTheme.typography.bodyMedium) }
        Text("延伸问题", style = MaterialTheme.typography.titleMedium)
        value.questions.forEach { Text(it, style = MaterialTheme.typography.bodyMedium) }
        Text("阅读路径", style = MaterialTheme.typography.titleMedium)
        value.readingPath.forEach { Text(it, style = MaterialTheme.typography.bodyMedium) }
      }
      Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        TextButton(onClick = onGenerate, enabled = !offline) { Text(if (report == null) "深度解析" else "重新生成") }
        if (statusText == "解析失败") TextButton(onClick = onRetry) { Text("重试") }
        TextButton(onClick = onShowHistory) { Text("历史版本") }
      }
    }
  }
}
