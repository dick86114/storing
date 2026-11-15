package com.idickies.storing.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowForward
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.AutoStories
import androidx.compose.material.icons.outlined.CheckCircle
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.DeleteOutline
import androidx.compose.material.icons.outlined.FormatLineSpacing
import androidx.compose.material.icons.outlined.Info
import androidx.compose.material.icons.outlined.Link
import androidx.compose.material.icons.outlined.Refresh
import androidx.compose.material.icons.outlined.Star
import androidx.compose.material.icons.outlined.TaskAlt
import androidx.compose.material.icons.outlined.WarningAmber
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.CornerRadius
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Size
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import coil3.compose.AsyncImage
import com.idickies.storing.library.DeepAnalysisReport
import com.idickies.storing.library.DeepAnalysisReportRecord
import com.idickies.storing.reader.DeepAnalysisAiWritingBand
import com.idickies.storing.reader.DeepAnalysisReportAnalytics
import com.idickies.storing.reader.DeepAnalysisReportSection
import java.time.OffsetDateTime
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

internal data class DeepAnalysisArticleContext(
  val title: String,
  val source: String?,
  val author: String?,
  val publishTime: String?,
  val coverImage: String?,
)

@Composable
internal fun DeepAnalysisReportContent(
  article: DeepAnalysisArticleContext,
  report: DeepAnalysisReport?,
  record: DeepAnalysisReportRecord?,
  statusText: String,
  offline: Boolean,
  loading: Boolean,
  errorMessage: String?,
  deleting: Boolean,
  onDismiss: () -> Unit,
  onGenerate: () -> Unit,
  onRetry: () -> Unit,
  onReload: () -> Unit,
  onDelete: () -> Unit,
) {
  val thoughts = remember(report) {
    report?.let(DeepAnalysisReportAnalytics::sectionThoughts).orEmpty()
  }

  LazyColumn(
    modifier = Modifier
      .fillMaxSize()
      .background(MaterialTheme.colorScheme.background)
      .statusBarsPadding()
      .navigationBarsPadding(),
    contentPadding = PaddingValues(start = 20.dp, end = 20.dp, bottom = 36.dp),
  ) {
    item {
      DeepAnalysisTopBar(
        statusText = statusText,
        loading = loading,
        offline = offline,
        showActions = report != null,
        deleting = deleting,
        onGenerate = onGenerate,
        onDelete = onDelete,
        onDismiss = onDismiss,
      )
    }

    if (report == null) {
      item {
        DeepAnalysisEmptyReport(
          statusText = statusText,
          loading = loading,
          offline = offline,
          errorMessage = errorMessage,
          onGenerate = onGenerate,
          onRetry = onRetry,
          onReload = onReload,
          onDelete = onDelete,
          deleting = deleting,
        )
      }
      return@LazyColumn
    }

    item {
      DeepAnalysisHero(
        article = article,
        report = report,
        offline = offline,
        errorMessage = errorMessage,
      )
    }

    item {
      DeepAnalysisMetrics(report)
    }

    item {
      Column(
        modifier = Modifier.padding(top = 12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
      ) {
        EvidenceCard(report)
        StanceCard(report)
      }
    }

    item {
      ReportSectionBlock(
        section = DeepAnalysisReportSection.AiWriting,
        thought = thoughts[DeepAnalysisReportSection.AiWriting],
      ) {
        AiWritingCard(report = report)
      }
    }

    item {
      ReportSectionBlock(
        section = DeepAnalysisReportSection.Arguments,
        thought = thoughts[DeepAnalysisReportSection.Arguments],
      ) {
        ArgumentsContent(report)
      }
    }

    item {
      ReportSectionBlock(
        section = DeepAnalysisReportSection.Reasoning,
        thought = thoughts[DeepAnalysisReportSection.Reasoning],
      ) {
        ReasoningContent(report)
      }
    }

    item {
      ReportSectionBlock(
        section = DeepAnalysisReportSection.Facts,
        thought = thoughts[DeepAnalysisReportSection.Facts],
      ) {
        FactsContent(report)
      }
    }

    item {
      ReportSectionBlock(
        section = DeepAnalysisReportSection.Viewpoints,
        thought = thoughts[DeepAnalysisReportSection.Viewpoints],
      ) {
        ViewpointsContent(report)
      }
    }

    item {
      ReportSectionBlock(
        section = DeepAnalysisReportSection.Risks,
        thought = thoughts[DeepAnalysisReportSection.Risks],
      ) {
        RisksContent(report)
      }
    }

    item {
      ReportSectionBlock(
        section = DeepAnalysisReportSection.Actions,
        thought = thoughts[DeepAnalysisReportSection.Actions],
      ) {
        ActionsContent(report)
      }
    }

    item {
      ReportSectionBlock(
        section = DeepAnalysisReportSection.Questions,
        thought = thoughts[DeepAnalysisReportSection.Questions],
      ) {
        QuestionsContent(report)
      }
    }

    item {
      ReportSectionBlock(
        section = DeepAnalysisReportSection.ReadingPath,
        thought = thoughts[DeepAnalysisReportSection.ReadingPath],
      ) {
        ReadingPathContent(report)
      }
    }

    item {
      ReportMetadataFooter(record = record)
    }
  }
}

@Composable
private fun DeepAnalysisTopBar(
  statusText: String,
  loading: Boolean,
  offline: Boolean,
  showActions: Boolean,
  deleting: Boolean,
  onGenerate: () -> Unit,
  onDelete: () -> Unit,
  onDismiss: () -> Unit,
) {
  Row(
    modifier = Modifier
      .fillMaxWidth()
      .padding(top = 2.dp, bottom = 14.dp),
    verticalAlignment = Alignment.CenterVertically,
    horizontalArrangement = Arrangement.spacedBy(10.dp),
  ) {
    Surface(
      color = MaterialTheme.colorScheme.primary.copy(alpha = 0.10f),
      shape = RoundedCornerShape(12.dp),
    ) {
      Icon(
        imageVector = Icons.Outlined.AutoStories,
        contentDescription = null,
        tint = MaterialTheme.colorScheme.primary,
        modifier = Modifier.padding(10.dp).size(20.dp),
      )
    }
    Column(modifier = Modifier.weight(1f)) {
      Text(
        "AI 增强阅读",
        style = MaterialTheme.typography.labelMedium,
        color = MaterialTheme.colorScheme.primary,
      )
      Text("深度报告", style = MaterialTheme.typography.titleLarge)
    }
    if (statusText != "已有报告" && statusText != "加载中") {
      StatusPill(text = statusText)
    }
    if (loading) {
      CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
    }
    if (showActions) {
      IconButton(
        onClick = onGenerate,
        enabled = !offline && !loading && !deleting,
      ) {
        Icon(
          Icons.Outlined.Refresh,
          contentDescription = "重新生成深度报告",
          tint = if (offline || loading) {
            MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.45f)
          } else {
            MaterialTheme.colorScheme.onSurface
          },
        )
      }
      IconButton(
        onClick = onDelete,
        enabled = !loading && !deleting,
      ) {
        Icon(
          Icons.Outlined.DeleteOutline,
          contentDescription = "删除深度报告",
          tint = if (deleting) {
            MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.45f)
          } else {
            MaterialTheme.colorScheme.error
          },
        )
      }
    }
    IconButton(onClick = onDismiss) {
      Icon(Icons.Outlined.Close, contentDescription = "关闭深度报告")
    }
  }
}

@Composable
private fun StatusPill(text: String) {
  val color = when (text) {
    "解析失败" -> MaterialTheme.colorScheme.error
    "解析中", "加载中" -> MaterialTheme.colorScheme.primary
    "已有报告" -> MaterialTheme.colorScheme.secondary
    else -> MaterialTheme.colorScheme.onSurfaceVariant
  }
  Surface(
    color = color.copy(alpha = 0.10f),
    shape = CircleShape,
  ) {
    Text(
      text,
      modifier = Modifier.padding(horizontal = 9.dp, vertical = 5.dp),
      style = MaterialTheme.typography.labelMedium,
      color = color,
    )
  }
}

@Composable
internal fun DeepAnalysisDeleteConfirmation(
  deleting: Boolean,
  onDismiss: () -> Unit,
  onConfirm: () -> Unit,
) {
  QiankunjieAlertDialog(
    onDismissRequest = { if (!deleting) onDismiss() },
    icon = {
      Icon(
        Icons.Outlined.DeleteOutline,
        contentDescription = null,
        tint = MaterialTheme.colorScheme.error,
      )
    },
    title = { Text("删除深度报告？") },
    text = { Text("这篇文章的全部历史版本都会删除。删除后需要重新生成才能恢复。") },
    dismissButton = {
      TextButton(onClick = onDismiss, enabled = !deleting) { Text("取消") }
    },
    confirmButton = {
      TextButton(onClick = onConfirm, enabled = !deleting) {
        Text("删除", color = MaterialTheme.colorScheme.error)
      }
    },
  )
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun DeepAnalysisHero(
  article: DeepAnalysisArticleContext,
  report: DeepAnalysisReport,
  offline: Boolean,
  errorMessage: String?,
) {
  Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
    Text(
      article.title,
      style = MaterialTheme.typography.headlineMedium,
      color = MaterialTheme.colorScheme.onBackground,
    )

    val source = article.source?.takeIf { it.isNotBlank() }
    val author = article.author?.takeIf { it.isNotBlank() }
    val metadata = buildList {
      source?.let { add("来源 $it") }
      author?.takeIf { it != source }?.let { add("作者 $it") }
      article.publishTime?.takeIf { it.isNotBlank() }?.let { add(formatShortDate(it)) }
    }
    if (metadata.isNotEmpty()) {
      FlowRow(
        horizontalArrangement = Arrangement.spacedBy(7.dp),
        verticalArrangement = Arrangement.spacedBy(7.dp),
      ) {
        metadata.forEach { item ->
          Surface(
            color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.55f),
            shape = CircleShape,
          ) {
            Text(
              item,
              modifier = Modifier.padding(horizontal = 9.dp, vertical = 4.dp),
              style = MaterialTheme.typography.labelMedium,
              color = MaterialTheme.colorScheme.onSurfaceVariant,
              maxLines = 1,
              overflow = TextOverflow.Ellipsis,
            )
          }
        }
      }
    }

    article.coverImage?.takeIf { it.isNotBlank() }?.let { cover ->
      AsyncImage(
        model = cover,
        contentDescription = null,
        contentScale = ContentScale.Crop,
        modifier = Modifier
          .fillMaxWidth()
          .height(178.dp)
          .clip(RoundedCornerShape(18.dp))
          .background(MaterialTheme.colorScheme.surfaceVariant),
      )
    }

    ThesisCard(report.executiveSummary)

    if (offline) {
      NoticeRow("当前离线，重新生成需要网络连接。", Icons.Outlined.Info)
    }
    errorMessage?.let {
      NoticeRow("加载提示：$it", Icons.Outlined.WarningAmber, isError = true)
    }

  }
}

@Composable
private fun ThesisCard(summary: String) {
  Surface(
    color = MaterialTheme.colorScheme.primary.copy(alpha = 0.065f),
    shape = RoundedCornerShape(18.dp),
    border = BorderStroke(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = 0.16f)),
  ) {
    Row(modifier = Modifier.height(IntrinsicSize.Min)) {
      Box(
        modifier = Modifier
          .width(3.dp)
          .fillMaxHeight()
          .background(MaterialTheme.colorScheme.primary),
      )
      Column(
        modifier = Modifier.padding(horizontal = 16.dp, vertical = 15.dp),
        verticalArrangement = Arrangement.spacedBy(7.dp),
      ) {
        Text(
          "一段看懂",
          style = MaterialTheme.typography.labelLarge,
          color = MaterialTheme.colorScheme.primary,
        )
        Text(
          summary,
          style = MaterialTheme.typography.bodyLarge,
          color = MaterialTheme.colorScheme.onSurface,
        )
      }
    }
  }
}

@Composable
private fun DeepAnalysisMetrics(report: DeepAnalysisReport) {
  val evidence = remember(report) { DeepAnalysisReportAnalytics.evidenceMix(report) }
  val stances = remember(report) { DeepAnalysisReportAnalytics.stanceMix(report) }

  Column(
    modifier = Modifier.padding(top = 24.dp),
    verticalArrangement = Arrangement.spacedBy(10.dp),
  ) {
    Row(
      modifier = Modifier.height(IntrinsicSize.Min),
      horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
      MetricCard(
        value = report.coreArguments.size,
        label = "核心论点",
        detail = "文章的主要主张",
        icon = Icons.Outlined.Star,
        modifier = Modifier.weight(1f).fillMaxHeight(),
      )
      MetricCard(
        value = report.keyFacts.size,
        label = "关键信息",
        detail = "${evidence.source} 条有原文依据",
        icon = Icons.Outlined.CheckCircle,
        modifier = Modifier.weight(1f).fillMaxHeight(),
      )
    }
    Row(
      modifier = Modifier.height(IntrinsicSize.Min),
      horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
      MetricCard(
        value = report.viewpoints.size,
        label = "不同观点",
        detail = "${stances.total} 个判断角度",
        icon = Icons.AutoMirrored.Outlined.ArrowForward,
        modifier = Modifier.weight(1f).fillMaxHeight(),
      )
      MetricCard(
        value = report.actions.size,
        label = "行动建议",
        detail = "附适用条件",
        icon = Icons.Outlined.TaskAlt,
        modifier = Modifier.weight(1f).fillMaxHeight(),
      )
    }
  }
}

@Composable
private fun MetricCard(
  value: Int,
  label: String,
  detail: String,
  icon: ImageVector,
  modifier: Modifier = Modifier,
) {
  Surface(
    modifier = modifier,
    color = MaterialTheme.colorScheme.surface,
    shape = RoundedCornerShape(16.dp),
    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.72f)),
  ) {
    Column(
      modifier = Modifier.padding(14.dp),
      verticalArrangement = Arrangement.spacedBy(5.dp),
    ) {
      Icon(
        icon,
        contentDescription = null,
        tint = MaterialTheme.colorScheme.primary,
        modifier = Modifier.size(18.dp),
      )
      Text(
        value.toString(),
        style = MaterialTheme.typography.headlineSmall.copy(fontWeight = FontWeight.SemiBold),
        color = MaterialTheme.colorScheme.onSurface,
      )
      Text(label, style = MaterialTheme.typography.labelLarge)
      Text(
        detail,
        style = MaterialTheme.typography.labelMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
      )
    }
  }
}

@Composable
private fun EvidenceCard(report: DeepAnalysisReport) {
  val evidence = remember(report) { DeepAnalysisReportAnalytics.evidenceMix(report) }
  InsightCard(title = "信息依据", subtitle = "关键信息从哪里来") {
    Row(
      horizontalArrangement = Arrangement.spacedBy(18.dp),
      verticalAlignment = Alignment.CenterVertically,
    ) {
      EvidenceDonut(percent = evidence.sourcePercent, size = 92.dp)
      Column(
        modifier = Modifier.weight(1f),
        verticalArrangement = Arrangement.spacedBy(8.dp),
      ) {
        LegendRow(
          color = MaterialTheme.colorScheme.primary,
          label = "原文有依据",
          count = evidence.source,
        )
        LegendRow(
          color = MaterialTheme.colorScheme.outline,
          label = "AI 推测",
          count = evidence.inference,
        )
        Text(
          "圆环只统计关键信息来源比例，不代表报告准确率。",
          style = MaterialTheme.typography.labelMedium,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
      }
    }
  }
}

@Composable
private fun StanceCard(report: DeepAnalysisReport) {
  val stances = remember(report) { DeepAnalysisReportAnalytics.stanceMix(report) }
  InsightCard(title = "观点分布", subtitle = "同一件事的不同看法") {
    StanceDistribution(stances)
  }
}

@Composable
private fun InsightCard(
  title: String,
  subtitle: String,
  content: @Composable ColumnScope.() -> Unit,
) {
  Surface(
    color = MaterialTheme.colorScheme.surface,
    shape = RoundedCornerShape(18.dp),
    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.72f)),
  ) {
    Column(
      modifier = Modifier.padding(16.dp),
      verticalArrangement = Arrangement.spacedBy(14.dp),
    ) {
      Row(verticalAlignment = Alignment.CenterVertically) {
        Text(title, style = MaterialTheme.typography.titleMedium)
        Spacer(Modifier.weight(1f))
        Text(
          subtitle,
          style = MaterialTheme.typography.labelMedium,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
      }
      content()
    }
  }
}

@Composable
private fun EvidenceDonut(percent: Int, size: androidx.compose.ui.unit.Dp) {
  val track = MaterialTheme.colorScheme.outline
  val accent = MaterialTheme.colorScheme.primary
  Box(modifier = Modifier.size(size), contentAlignment = Alignment.Center) {
    Canvas(modifier = Modifier.fillMaxSize()) {
      val strokeWidth = 9.dp.toPx()
      drawCircle(
        color = track,
        style = Stroke(width = strokeWidth),
      )
      drawArc(
        color = accent,
        startAngle = -90f,
        sweepAngle = 360f * percent.coerceIn(0, 100) / 100f,
        useCenter = false,
        style = Stroke(width = strokeWidth, cap = StrokeCap.Round),
      )
    }
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
      Text(
        "$percent%",
        style = MaterialTheme.typography.titleLarge.copy(fontWeight = FontWeight.Bold),
      )
      Text(
        "来自原文",
        style = MaterialTheme.typography.labelMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
      )
    }
  }
}

@Composable
private fun LegendRow(color: Color, label: String, count: Int) {
  Row(
    verticalAlignment = Alignment.CenterVertically,
    horizontalArrangement = Arrangement.spacedBy(7.dp),
  ) {
    Box(
      modifier = Modifier
        .size(7.dp)
        .background(color, CircleShape),
    )
    Text(label, style = MaterialTheme.typography.bodyMedium)
    Spacer(Modifier.weight(1f))
    Text(
      count.toString(),
      style = MaterialTheme.typography.labelLarge,
      color = MaterialTheme.colorScheme.onSurface,
    )
  }
}

@Composable
private fun StanceDistribution(mix: com.idickies.storing.reader.DeepAnalysisStanceMix) {
  Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
    if (mix.total == 0) {
      Box(
        Modifier
          .fillMaxWidth()
          .height(10.dp)
          .background(MaterialTheme.colorScheme.outline, CircleShape),
      )
    } else {
      Row(
        modifier = Modifier
          .fillMaxWidth()
          .height(10.dp)
          .clip(CircleShape),
      ) {
        if (mix.support > 0) {
          Box(
            Modifier
              .weight(mix.support.toFloat())
              .fillMaxHeight()
              .background(MaterialTheme.colorScheme.primary),
          )
        }
        if (mix.conditional > 0) {
          Box(
            Modifier
              .weight(mix.conditional.toFloat())
              .fillMaxHeight()
              .background(MaterialTheme.colorScheme.primary.copy(alpha = 0.46f)),
          )
        }
        if (mix.oppose > 0) {
          Box(
            Modifier
              .weight(mix.oppose.toFloat())
              .fillMaxHeight()
              .background(MaterialTheme.colorScheme.onSurface.copy(alpha = 0.52f)),
          )
        }
      }
    }

    StanceRow("支持", mix.support, mix.supportPercent, MaterialTheme.colorScheme.primary)
    StanceRow(
      "有条件",
      mix.conditional,
      mix.conditionalPercent,
      MaterialTheme.colorScheme.primary.copy(alpha = 0.46f),
    )
    StanceRow(
      "反驳",
      mix.oppose,
      mix.opposePercent,
      MaterialTheme.colorScheme.onSurface.copy(alpha = 0.52f),
    )
    Text(
      "这个条只表示报告整理出的观点数量，不代表文章作者持哪种立场。",
      style = MaterialTheme.typography.labelMedium,
      color = MaterialTheme.colorScheme.onSurfaceVariant,
    )
  }
}

@Composable
private fun StanceRow(label: String, count: Int, percent: Int, color: Color) {
  Row(
    modifier = Modifier
      .fillMaxWidth()
      .background(
        MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.45f),
        RoundedCornerShape(9.dp),
      )
      .padding(horizontal = 10.dp, vertical = 6.dp),
    verticalAlignment = Alignment.CenterVertically,
    horizontalArrangement = Arrangement.spacedBy(7.dp),
  ) {
    Box(Modifier.size(7.dp).background(color, CircleShape))
    Text(label, style = MaterialTheme.typography.bodyMedium)
    Spacer(Modifier.weight(1f))
    Text("$count 个", style = MaterialTheme.typography.labelLarge)
    Text(
      "$percent%",
      style = MaterialTheme.typography.labelMedium,
      color = MaterialTheme.colorScheme.onSurfaceVariant,
      modifier = Modifier.width(38.dp),
    )
  }
}

@Composable
private fun ReportSectionBlock(
  section: DeepAnalysisReportSection,
  thought: String?,
  content: @Composable ColumnScope.() -> Unit,
) {
  Column(
    modifier = Modifier.padding(top = 28.dp),
    verticalArrangement = Arrangement.spacedBy(13.dp),
  ) {
    Row(verticalAlignment = Alignment.Top) {
      Column(modifier = Modifier.weight(1f)) {
        Text(section.title, style = MaterialTheme.typography.headlineSmall)
        Text(
          section.hint,
          style = MaterialTheme.typography.bodyMedium,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
      }
      Surface(
        color = MaterialTheme.colorScheme.primary.copy(alpha = 0.10f),
        shape = RoundedCornerShape(10.dp),
      ) {
        Icon(
          sectionIcon(section),
          contentDescription = null,
          tint = MaterialTheme.colorScheme.primary,
          modifier = Modifier.padding(8.dp).size(18.dp),
        )
      }
    }
    thought?.let { MainIdeaCard(it) }
    content()
  }
}

@Composable
private fun MainIdeaCard(text: String) {
  Surface(
    color = MaterialTheme.colorScheme.primary.copy(alpha = 0.055f),
    shape = RoundedCornerShape(13.dp),
  ) {
    Row(
      modifier = Modifier
        .fillMaxWidth()
        .padding(horizontal = 13.dp, vertical = 11.dp),
      horizontalArrangement = Arrangement.spacedBy(10.dp),
      verticalAlignment = Alignment.Top,
    ) {
      Box(
        modifier = Modifier
          .padding(top = 3.dp)
          .width(2.dp)
          .height(30.dp)
          .background(MaterialTheme.colorScheme.primary, RoundedCornerShape(999.dp)),
      )
      Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Text(
          "本段主旨",
          style = MaterialTheme.typography.labelMedium,
          color = MaterialTheme.colorScheme.primary,
        )
        Text(text, style = MaterialTheme.typography.bodyMedium)
      }
    }
  }
}

@Composable
private fun AiWritingCard(
  report: DeepAnalysisReport,
) {
  val writing = report.aiWriting
  if (writing == null) {
    Surface(
      color = MaterialTheme.colorScheme.surface,
      shape = RoundedCornerShape(18.dp),
      border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.72f)),
    ) {
      Column(
        modifier = Modifier.padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
      ) {
        Text("这份报告暂无写作倾向判断", style = MaterialTheme.typography.titleMedium)
        Text(
          "重新生成后会补充分数、判断依据和不确定性说明。",
          style = MaterialTheme.typography.bodyMedium,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
      }
    }
    return
  }

  val band = DeepAnalysisReportAnalytics.aiWritingBand(writing.score)
  val score = writing.score.coerceIn(0, 100)

  Surface(
    color = MaterialTheme.colorScheme.surface,
    shape = RoundedCornerShape(18.dp),
    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.72f)),
  ) {
    Column(
      modifier = Modifier.padding(18.dp),
      verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
      Row(
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.Top,
      ) {
        Column(
          modifier = Modifier.weight(1f),
          verticalArrangement = Arrangement.spacedBy(5.dp),
        ) {
          Text("这篇文章像 AI 写的吗？", style = MaterialTheme.typography.titleLarge)
          Text(
            "根据用词、结构、细节和引用方式做倾向判断，不是作者身份鉴定。",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
          )
        }
        Surface(
          color = MaterialTheme.colorScheme.primary.copy(alpha = 0.10f),
          shape = RoundedCornerShape(14.dp),
        ) {
          Column(
            modifier = Modifier.padding(horizontal = 13.dp, vertical = 10.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
          ) {
            Row(verticalAlignment = Alignment.Bottom) {
              Text(
                score.toString(),
                style = MaterialTheme.typography.headlineMedium.copy(fontWeight = FontWeight.Bold),
                color = MaterialTheme.colorScheme.onSurface,
              )
              Text(
                "/100",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
              )
            }
            Text(
              band?.label ?: "倾向不明显",
              style = MaterialTheme.typography.labelMedium,
              color = MaterialTheme.colorScheme.primary,
            )
          }
        }
      }

      AiWritingMeter(score)

      Text(
        writing.summary,
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.onSurface,
      )

      if (writing.signals.isNotEmpty()) {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
          Text(
            "判断依据 · ${writing.signals.size} 条文本线索",
            style = MaterialTheme.typography.labelLarge,
          )
          writing.signals.forEach { signal ->
            AiSignalCard(
              leaning = signal.leaning,
              label = signal.label,
              detail = signal.detail,
            )
          }
        }
      }

      Surface(
        color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.55f),
        shape = RoundedCornerShape(12.dp),
      ) {
        Row(
          modifier = Modifier.padding(12.dp),
          horizontalArrangement = Arrangement.spacedBy(8.dp),
          verticalAlignment = Alignment.Top,
        ) {
          Icon(
            Icons.Outlined.Info,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(17.dp),
          )
          Text(
            "这是基于文本特征的倾向判断，不是作者身份鉴定。改写、模板化写作和人机协作都可能造成误判。",
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
          )
        }
      }
    }
  }
}

@Composable
private fun AiWritingMeter(score: Int) {
  val human = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.32f)
  val mixed = MaterialTheme.colorScheme.primary.copy(alpha = 0.40f)
  val ai = MaterialTheme.colorScheme.primary
  val marker = MaterialTheme.colorScheme.onSurface
  val surface = MaterialTheme.colorScheme.background

  Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
    Canvas(
      modifier = Modifier
        .fillMaxWidth()
        .height(20.dp),
    ) {
      val segmentWidth = size.width / 3f
      val radius = CornerRadius(size.height / 2f, size.height / 2f)
      drawRoundRect(
        color = human,
        topLeft = Offset(0f, 0f),
        size = Size(segmentWidth, size.height),
        cornerRadius = radius,
      )
      drawRect(
        color = mixed,
        topLeft = Offset(segmentWidth, 0f),
        size = Size(segmentWidth, size.height),
      )
      drawRoundRect(
        color = ai,
        topLeft = Offset(segmentWidth * 2f, 0f),
        size = Size(segmentWidth, size.height),
        cornerRadius = radius,
      )
      val x = size.width * score / 100f
      drawCircle(
        color = surface,
        radius = 9.dp.toPx(),
        center = Offset(x.coerceIn(9.dp.toPx(), size.width - 9.dp.toPx()), size.height / 2f),
      )
      drawCircle(
        color = marker,
        radius = 6.dp.toPx(),
        center = Offset(x.coerceIn(9.dp.toPx(), size.width - 9.dp.toPx()), size.height / 2f),
      )
    }
    Row(modifier = Modifier.fillMaxWidth()) {
      Text(
        "更像人工",
        modifier = Modifier.weight(1f),
        style = MaterialTheme.typography.labelMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
      )
      Text(
        "混合 / 不明显",
        modifier = Modifier.weight(1f),
        style = MaterialTheme.typography.labelMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
      )
      Text(
        "更像 AI",
        modifier = Modifier.weight(1f),
        style = MaterialTheme.typography.labelMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
      )
    }
  }
}

@Composable
private fun AiSignalCard(leaning: String, label: String, detail: String) {
  val color = when (leaning) {
    "ai" -> MaterialTheme.colorScheme.primary
    "human" -> MaterialTheme.colorScheme.onSurface
    else -> MaterialTheme.colorScheme.onSurfaceVariant
  }
  Surface(
    color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.45f),
    shape = RoundedCornerShape(12.dp),
  ) {
    Column(
      modifier = Modifier
        .fillMaxWidth()
        .padding(12.dp),
      verticalArrangement = Arrangement.spacedBy(5.dp),
    ) {
      Surface(
        color = color.copy(alpha = 0.10f),
        shape = CircleShape,
      ) {
        Text(
          aiWritingLeaningLabel(leaning),
          modifier = Modifier.padding(horizontal = 7.dp, vertical = 3.dp),
          style = MaterialTheme.typography.labelMedium,
          color = color,
        )
      }
      Text(label, style = MaterialTheme.typography.titleMedium)
      Text(
        detail,
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
      )
    }
  }
}

@Composable
private fun ArgumentsContent(report: DeepAnalysisReport) {
  Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
    report.coreArguments.forEachIndexed { index, argument ->
      Surface(
        color = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(16.dp),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.65f)),
      ) {
        Row(
          modifier = Modifier.padding(15.dp),
          horizontalArrangement = Arrangement.spacedBy(12.dp),
          verticalAlignment = Alignment.Top,
        ) {
          NumberBadge(index + 1)
          Column(
            modifier = Modifier.weight(1f),
            verticalArrangement = Arrangement.spacedBy(7.dp),
          ) {
            Text(argument.claim, style = MaterialTheme.typography.titleMedium)
            Text(
              argument.evidence,
              style = MaterialTheme.typography.bodyMedium,
              color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            argument.quoteAnchor?.takeIf { it.isNotBlank() }?.let {
              Text(
                "原文位置：$it",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.78f),
              )
            }
          }
        }
      }
    }
  }
}

@Composable
private fun NumberBadge(number: Int) {
  Surface(
    color = MaterialTheme.colorScheme.primary.copy(alpha = 0.10f),
    shape = CircleShape,
    modifier = Modifier.size(32.dp),
  ) {
    Box(contentAlignment = Alignment.Center) {
      Text(
        number.toString().padStart(2, '0'),
        style = MaterialTheme.typography.labelMedium,
        color = MaterialTheme.colorScheme.primary,
      )
    }
  }
}

@Composable
private fun ReasoningContent(report: DeepAnalysisReport) {
  Column(verticalArrangement = Arrangement.spacedBy(0.dp)) {
    report.reasoningChain.forEachIndexed { index, step ->
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.Top,
      ) {
        NumberBadge(index + 1)
        Column(
          modifier = Modifier
            .weight(1f)
            .padding(top = 3.dp, bottom = 18.dp),
        ) {
          Text(step, style = MaterialTheme.typography.bodyLarge)
        }
      }
    }
  }
}

@Composable
private fun FactsContent(report: DeepAnalysisReport) {
  val evidence = remember(report) { DeepAnalysisReportAnalytics.evidenceMix(report) }
  Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
    Surface(
      color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.52f),
      shape = RoundedCornerShape(16.dp),
    ) {
      Row(
        modifier = Modifier.padding(14.dp),
        horizontalArrangement = Arrangement.spacedBy(16.dp),
        verticalAlignment = Alignment.CenterVertically,
      ) {
        EvidenceDonut(percent = evidence.sourcePercent, size = 76.dp)
        Column(
          modifier = Modifier.weight(1f),
          verticalArrangement = Arrangement.spacedBy(7.dp),
        ) {
          LegendRow(
            color = MaterialTheme.colorScheme.primary,
            label = "原文有依据",
            count = evidence.source,
          )
          LegendRow(
            color = MaterialTheme.colorScheme.outline,
            label = "AI 推测",
            count = evidence.inference,
          )
          Text(
            "优先核对有原文依据的条目。",
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
          )
        }
      }
    }

    report.keyFacts.forEach { fact ->
      val source = fact.basis == "source"
      Surface(
        color = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(14.dp),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.65f)),
      ) {
        Column(
          modifier = Modifier.padding(14.dp),
          verticalArrangement = Arrangement.spacedBy(7.dp),
        ) {
          Surface(
            color = if (source) {
              MaterialTheme.colorScheme.primary.copy(alpha = 0.10f)
            } else {
              MaterialTheme.colorScheme.surfaceVariant
            },
            shape = CircleShape,
          ) {
            Text(
              if (source) "原文有依据" else "AI 推测",
              modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
              style = MaterialTheme.typography.labelMedium,
              color = if (source) {
                MaterialTheme.colorScheme.primary
              } else {
                MaterialTheme.colorScheme.onSurfaceVariant
              },
            )
          }
          Text(fact.fact, style = MaterialTheme.typography.bodyLarge)
          fact.quoteAnchor?.takeIf { it.isNotBlank() }?.let {
            Text(
              it,
              style = MaterialTheme.typography.labelMedium,
              color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
          }
        }
      }
    }
  }
}

@Composable
private fun ViewpointsContent(report: DeepAnalysisReport) {
  val stances = remember(report) { DeepAnalysisReportAnalytics.stanceMix(report) }
  Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
    Surface(
      color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.50f),
      shape = RoundedCornerShape(16.dp),
    ) {
      Box(Modifier.padding(14.dp)) {
        StanceDistribution(stances)
      }
    }
    report.viewpoints.forEach { viewpoint ->
      val color = stanceColor(viewpoint.stance)
      Surface(
        color = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(16.dp),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.65f)),
      ) {
        Column(
          modifier = Modifier.padding(15.dp),
          verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
          Surface(color = color.copy(alpha = 0.10f), shape = CircleShape) {
            Text(
              stanceLabel(viewpoint.stance),
              modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
              style = MaterialTheme.typography.labelMedium,
              color = color,
            )
          }
          Text(viewpoint.summary, style = MaterialTheme.typography.titleMedium)
          Text(
            viewpoint.reasoning,
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
          )
        }
      }
    }
  }
}

@Composable
private fun RisksContent(report: DeepAnalysisReport) {
  Surface(
    color = MaterialTheme.colorScheme.surface,
    shape = RoundedCornerShape(16.dp),
    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.65f)),
  ) {
    Column(modifier = Modifier.padding(horizontal = 15.dp, vertical = 4.dp)) {
      report.risks.forEachIndexed { index, risk ->
        Row(
          modifier = Modifier.padding(vertical = 12.dp),
          horizontalArrangement = Arrangement.spacedBy(10.dp),
          verticalAlignment = Alignment.Top,
        ) {
          Icon(
            Icons.Outlined.WarningAmber,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.primary,
            modifier = Modifier.size(19.dp),
          )
          Text(risk, style = MaterialTheme.typography.bodyMedium)
        }
        if (index < report.risks.lastIndex) {
          androidx.compose.material3.HorizontalDivider(
            color = MaterialTheme.colorScheme.outline.copy(alpha = 0.55f),
          )
        }
      }
    }
  }
}

@Composable
private fun ActionsContent(report: DeepAnalysisReport) {
  Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
    report.actions.forEachIndexed { index, action ->
      Surface(
        color = MaterialTheme.colorScheme.surface,
        shape = RoundedCornerShape(16.dp),
        border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.65f)),
      ) {
        Column(
          modifier = Modifier.padding(15.dp),
          verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
          Row(
            horizontalArrangement = Arrangement.spacedBy(8.dp),
            verticalAlignment = Alignment.CenterVertically,
          ) {
            Icon(
              Icons.Outlined.TaskAlt,
              contentDescription = null,
              tint = MaterialTheme.colorScheme.primary,
              modifier = Modifier.size(19.dp),
            )
            Text(
              "建议 ${index + 1}",
              style = MaterialTheme.typography.labelMedium,
              color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
          }
          Text(action.action, style = MaterialTheme.typography.titleMedium)
          androidx.compose.material3.HorizontalDivider(
            color = MaterialTheme.colorScheme.outline.copy(alpha = 0.55f),
          )
          Text(
            "适用条件：${action.condition}",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
          )
        }
      }
    }
  }
}

@Composable
private fun QuestionsContent(report: DeepAnalysisReport) {
  Surface(
    color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.38f),
    shape = RoundedCornerShape(16.dp),
  ) {
    Column(modifier = Modifier.padding(horizontal = 15.dp, vertical = 4.dp)) {
      report.questions.forEachIndexed { index, question ->
        Row(
          modifier = Modifier.padding(vertical = 12.dp),
          horizontalArrangement = Arrangement.spacedBy(10.dp),
          verticalAlignment = Alignment.Top,
        ) {
          Icon(
            Icons.Outlined.Info,
            contentDescription = null,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
            modifier = Modifier.size(18.dp),
          )
          Text(question, style = MaterialTheme.typography.bodyMedium)
        }
        if (index < report.questions.lastIndex) {
          androidx.compose.material3.HorizontalDivider(
            color = MaterialTheme.colorScheme.outline.copy(alpha = 0.50f),
          )
        }
      }
    }
  }
}

@Composable
private fun ReadingPathContent(report: DeepAnalysisReport) {
  Column(verticalArrangement = Arrangement.spacedBy(0.dp)) {
    report.readingPath.forEachIndexed { index, step ->
      Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalAlignment = Alignment.Top,
      ) {
        Surface(
          color = MaterialTheme.colorScheme.primary.copy(alpha = 0.10f),
          shape = CircleShape,
          modifier = Modifier.size(30.dp),
        ) {
          Box(contentAlignment = Alignment.Center) {
            Icon(
              Icons.Outlined.Link,
              contentDescription = null,
              tint = MaterialTheme.colorScheme.primary,
              modifier = Modifier.size(15.dp),
            )
          }
        }
        Column(
          modifier = Modifier
            .weight(1f)
            .padding(top = 1.dp, bottom = 18.dp),
          verticalArrangement = Arrangement.spacedBy(3.dp),
        ) {
          Text(
            "节点 ${index + 1}",
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
          )
          Text(step, style = MaterialTheme.typography.bodyLarge)
        }
      }
    }
  }
}

@Composable
private fun ReportMetadataFooter(record: DeepAnalysisReportRecord?) {
  Surface(
    modifier = Modifier.padding(top = 30.dp),
    color = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.40f),
    shape = RoundedCornerShape(16.dp),
  ) {
    Column(
      modifier = Modifier.padding(16.dp),
      verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
      Text("报告信息", style = MaterialTheme.typography.titleMedium)
      record?.generatedAt?.let { MetaLine("生成时间", formatReportDate(it)) }
      record?.modelSnapshot?.takeIf { it.isNotBlank() }?.let { MetaLine("模型", it) }
      record?.version?.let { MetaLine("版本", it.toString()) }
      record?.durationMs?.let { MetaLine("生成耗时", formatDuration(it)) }
      record?.let { value ->
        if (value.promptTokens != null || value.completionTokens != null || value.totalTokens != null) {
          MetaLine(
            "Token 用量",
            "输入 ${value.promptTokens ?: 0} / 输出 ${value.completionTokens ?: 0} / 总计 ${value.totalTokens ?: 0}",
          )
        }
      }
      record?.providerSnapshot?.takeIf { it.isNotBlank() }?.let { MetaLine("调用工具", it) }
      record?.attempts?.let { MetaLine("尝试次数", "第 $it 次") }
      Text(
        "费用以你的模型服务商账单为准，系统只记录 Token 用量。关键事实请回到原文核对。",
        style = MaterialTheme.typography.labelMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
      )
    }
  }
}

@Composable
private fun MetaLine(label: String, value: String) {
  Row(
    modifier = Modifier.fillMaxWidth(),
    horizontalArrangement = Arrangement.spacedBy(12.dp),
  ) {
    Text(
      label,
      modifier = Modifier.width(70.dp),
      style = MaterialTheme.typography.labelMedium,
      color = MaterialTheme.colorScheme.onSurfaceVariant,
    )
    Text(
      value,
      modifier = Modifier.weight(1f),
      style = MaterialTheme.typography.bodyMedium,
      color = MaterialTheme.colorScheme.onSurface,
    )
  }
}

@Composable
private fun DeepAnalysisEmptyReport(
  statusText: String,
  loading: Boolean,
  offline: Boolean,
  errorMessage: String?,
  onGenerate: () -> Unit,
  onRetry: () -> Unit,
  onReload: () -> Unit,
  onDelete: () -> Unit,
  deleting: Boolean,
) {
  Column(
    modifier = Modifier
      .fillMaxWidth()
      .padding(top = 36.dp),
    horizontalAlignment = Alignment.CenterHorizontally,
    verticalArrangement = Arrangement.spacedBy(14.dp),
  ) {
    Surface(
      color = MaterialTheme.colorScheme.primary.copy(alpha = 0.10f),
      shape = RoundedCornerShape(22.dp),
    ) {
      Icon(
        if (statusText == "解析失败") Icons.Outlined.WarningAmber else Icons.Outlined.AutoStories,
        contentDescription = null,
        tint = MaterialTheme.colorScheme.primary,
        modifier = Modifier.padding(20.dp).size(34.dp),
      )
    }
    Text(
      when (statusText) {
        "加载中" -> "正在加载报告"
        "解析中" -> "深度报告正在生成"
        "解析失败" -> "深度报告生成失败"
        else -> "还没有深度报告"
      },
      style = MaterialTheme.typography.headlineSmall,
    )
    Text(
      when {
        errorMessage != null -> errorMessage
        statusText == "解析中" || statusText == "加载中" -> "完成后这里会自动刷新，你可以先关闭弹层继续阅读文章。"
        statusText == "解析失败" -> "可以重新生成一份报告，旧内容不会受影响。"
        else -> "生成后会在这里呈现核心论点、信息来源、不同观点和行动建议。"
      },
      style = MaterialTheme.typography.bodyMedium,
      color = MaterialTheme.colorScheme.onSurfaceVariant,
    )
    if (loading) {
      LinearProgressIndicator(modifier = Modifier.fillMaxWidth(0.55f))
    }
    if (offline) {
      Text(
        "当前离线，重新生成需要网络连接。",
        style = MaterialTheme.typography.labelMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
      )
    }
    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
      if (errorMessage != null && statusText != "解析失败") {
        OutlinedButton(onClick = onReload, enabled = !loading) { Text("重新加载") }
      }
      if (statusText == "解析失败") {
        OutlinedButton(onClick = onRetry, enabled = !loading) { Text("重试") }
      }
      if (statusText == "未生成") {
        OutlinedButton(onClick = onGenerate, enabled = !loading && !offline) {
          Text("生成深度报告")
        }
      }
      TextButton(onClick = onDelete, enabled = !loading && !deleting) { Text("删除报告") }
    }
  }
}

@Composable
private fun NoticeRow(
  text: String,
  icon: ImageVector,
  isError: Boolean = false,
) {
  val color = if (isError) {
    MaterialTheme.colorScheme.error
  } else {
    MaterialTheme.colorScheme.onSurfaceVariant
  }
  Surface(
    color = color.copy(alpha = 0.08f),
    shape = RoundedCornerShape(11.dp),
  ) {
    Row(
      modifier = Modifier
        .fillMaxWidth()
        .padding(horizontal = 12.dp, vertical = 9.dp),
      horizontalArrangement = Arrangement.spacedBy(8.dp),
      verticalAlignment = Alignment.Top,
    ) {
      Icon(icon, contentDescription = null, tint = color, modifier = Modifier.size(17.dp))
      Text(text, style = MaterialTheme.typography.labelMedium, color = color)
    }
  }
}

private fun sectionIcon(section: DeepAnalysisReportSection): ImageVector = when (section) {
  DeepAnalysisReportSection.AiWriting -> Icons.Outlined.AutoAwesome
  DeepAnalysisReportSection.Arguments -> Icons.Outlined.Star
  DeepAnalysisReportSection.Reasoning -> Icons.Outlined.FormatLineSpacing
  DeepAnalysisReportSection.Facts -> Icons.Outlined.CheckCircle
  DeepAnalysisReportSection.Viewpoints -> Icons.AutoMirrored.Outlined.ArrowForward
  DeepAnalysisReportSection.Risks -> Icons.Outlined.WarningAmber
  DeepAnalysisReportSection.Actions -> Icons.Outlined.TaskAlt
  DeepAnalysisReportSection.Questions -> Icons.Outlined.Info
  DeepAnalysisReportSection.ReadingPath -> Icons.Outlined.Link
}

private fun stanceLabel(stance: String): String = when (stance) {
  "support" -> "支持"
  "oppose" -> "反驳"
  "conditional" -> "有条件"
  else -> "观点"
}

@Composable
private fun stanceColor(stance: String): Color = when (stance) {
  "support" -> MaterialTheme.colorScheme.primary
  "oppose" -> MaterialTheme.colorScheme.onSurface.copy(alpha = 0.68f)
  else -> MaterialTheme.colorScheme.primary.copy(alpha = 0.68f)
}

private fun aiWritingLeaningLabel(leaning: String): String = when (leaning) {
  "ai" -> "支持 AI"
  "human" -> "支持人工"
  else -> "中性线索"
}

private fun formatShortDate(value: String): String {
  val trimmed = value.trim()
  return if (trimmed.length >= 10) trimmed.take(10) else trimmed
}

private fun formatReportDate(value: String): String = runCatching {
  val parseValue = if (value.length == 10) "${value}T00:00:00Z" else value
  val formatter = DateTimeFormatter.ofPattern("yyyy年M月d日 HH:mm", Locale.CHINA)
  OffsetDateTime.parse(parseValue)
    .atZoneSameInstant(ZoneId.systemDefault())
    .format(formatter)
}.getOrDefault(value)

private fun formatDuration(durationMs: Int): String {
  val seconds = (durationMs / 1000.0).toInt().coerceAtLeast(0)
  return if (seconds < 60) {
    "${seconds} 秒"
  } else {
    "${seconds / 60} 分 ${seconds % 60} 秒"
  }
}
