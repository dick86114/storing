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
        value.aiWriting?.let { aiWriting ->
          Text("AI 写作倾向", style = MaterialTheme.typography.titleMedium)
          Text(
            "${aiWriting.score}/100 · ${aiWritingLabel(aiWriting.score)}",
            style = MaterialTheme.typography.titleSmall,
            color = MaterialTheme.colorScheme.primary,
          )
          Text(aiWriting.summary, style = MaterialTheme.typography.bodyMedium)
          aiWriting.signals.forEach { signal ->
            Text(
              "${aiWritingLeaningLabel(signal.leaning)} · ${signal.label}：${signal.detail}",
              style = MaterialTheme.typography.bodySmall,
            )
          }
          Text(
            "这是基于文本特征的倾向判断，不是作者身份鉴定。",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
          )
        }
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

private fun aiWritingLabel(score: Int): String = when {
  score >= 60 -> "更像 AI 写作"
  score >= 30 -> "人机混合或特征不明显"
  else -> "更像人工写作"
}

private fun aiWritingLeaningLabel(leaning: String): String = when (leaning) {
  "ai" -> "支持 AI"
  "human" -> "支持人工"
  else -> "中性线索"
}
