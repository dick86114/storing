package com.idickies.storing.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.ExpandLess
import androidx.compose.material.icons.outlined.ExpandMore
import androidx.compose.material.icons.outlined.Palette
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.unit.dp
import androidx.core.graphics.toColorInt
import com.idickies.storing.categories.MAX_CATEGORY_NAME_LENGTH
import com.idickies.storing.categories.categoryDefaultColors
import com.idickies.storing.categories.stableCategoryColor
import com.idickies.storing.library.CategoryMutationRequest

internal data class CategoryQuickCreateDraft(
  val name: String = "",
  val description: String = "",
  val includeExamples: String = "",
  val excludeExamples: String = "",
  val color: String = stableCategoryColor(""),
  val colorManuallyEdited: Boolean = false,
)

internal fun CategoryQuickCreateDraft.withName(value: String): CategoryQuickCreateDraft {
  val limited = value.take(MAX_CATEGORY_NAME_LENGTH)
  return copy(
    name = limited,
    color = if (colorManuallyEdited) color else stableCategoryColor(limited),
  )
}

internal fun CategoryQuickCreateDraft.toMutationRequest(): CategoryMutationRequest =
  CategoryMutationRequest(
    name = name.trim(),
    description = description.trim().ifBlank { null },
    includeExamples = includeExamples.lines().map(String::trim).filter(String::isNotBlank),
    excludeExamples = excludeExamples.lines().map(String::trim).filter(String::isNotBlank),
    color = color,
  )

internal val categoryPresetColors = categoryDefaultColors
internal const val categoryAiOptimizeLabel = "AI 优化"
internal const val categoryRuleHelpText = "适合收录用于描述典型主题、文章类型或问题场景；不适合收录用于说明容易混淆、但应归入其他分类的内容。每行一个例子，越具体越有助于 AI 判断。"

@Composable
internal fun CategoryQuickCreateFields(
  draft: CategoryQuickCreateDraft,
  expanded: Boolean,
  enabled: Boolean,
  errorMessage: String?,
  onDraftChange: (CategoryQuickCreateDraft) -> Unit,
  onExpandedChange: (Boolean) -> Unit,
  onOptimize: (() -> Unit)? = null,
  optimizing: Boolean = false,
  showDetailsToggle: Boolean = true,
  showNameField: Boolean = true,
) {
  Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
    if (showNameField) {
      OutlinedTextField(
        value = draft.name,
        onValueChange = { onDraftChange(draft.withName(it)) },
        label = { Text("分类名称") },
        placeholder = { Text("例如：产品设计") },
        singleLine = true,
        enabled = enabled,
        isError = errorMessage != null,
        supportingText = {
          Text(errorMessage ?: "${draft.name.length}/$MAX_CATEGORY_NAME_LENGTH")
        },
        keyboardOptions = KeyboardOptions(imeAction = ImeAction.Done),
        modifier = Modifier.fillMaxWidth(),
      )
    }
    if (showDetailsToggle) {
      TextButton(
        onClick = { onExpandedChange(!expanded) },
        enabled = enabled,
        modifier = Modifier.fillMaxWidth(),
      ) {
        Icon(if (expanded) Icons.Outlined.ExpandLess else Icons.Outlined.ExpandMore, contentDescription = null, modifier = Modifier.size(17.dp))
        Spacer(Modifier.width(5.dp))
        Text(if (expanded) "收起详细规则" else "详细规则（可选）")
      }
    }
    if (expanded) {
      Row(verticalAlignment = Alignment.CenterVertically) {
        Text("分类说明", style = MaterialTheme.typography.labelLarge, modifier = Modifier.weight(1f))
        onOptimize?.let {
          TextButton(onClick = it, enabled = draft.name.isNotBlank() && enabled) {
            Icon(Icons.Outlined.AutoAwesome, contentDescription = null, modifier = Modifier.size(16.dp))
            Spacer(Modifier.width(4.dp))
            Text(if (optimizing) "正在优化…" else categoryAiOptimizeLabel)
          }
        }
      }
      OutlinedTextField(
        value = draft.description,
        onValueChange = { onDraftChange(draft.copy(description = it)) },
        placeholder = { Text("用一句话说明这个分类的长期归属边界。") },
        minLines = 2,
        enabled = enabled,
        modifier = Modifier.fillMaxWidth(),
      )
      Text(
        "未填写说明时，AI 会更倾向于把不明确文章放入待整理。",
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        style = MaterialTheme.typography.bodySmall,
      )
      Surface(color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.42f), shape = MaterialTheme.shapes.medium) {
        Row(modifier = Modifier.padding(11.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.Top) {
          Icon(Icons.Outlined.AutoAwesome, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(17.dp))
          Text(categoryRuleHelpText, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
        }
      }
      OutlinedTextField(
        value = draft.includeExamples,
        onValueChange = { onDraftChange(draft.copy(includeExamples = it)) },
        label = { Text("适合收录") },
        placeholder = { Text("Docker 部署与运维\n容器网络与镜像") },
        minLines = 2,
        enabled = enabled,
        modifier = Modifier.fillMaxWidth(),
      )
      OutlinedTextField(
        value = draft.excludeExamples,
        onValueChange = { onDraftChange(draft.copy(excludeExamples = it)) },
        label = { Text("不适合收录") },
        placeholder = { Text("纯产品新闻\n个人生活随笔") },
        minLines = 2,
        enabled = enabled,
        modifier = Modifier.fillMaxWidth(),
      )
      Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(7.dp)) {
          Icon(Icons.Outlined.Palette, contentDescription = null, modifier = Modifier.size(16.dp), tint = MaterialTheme.colorScheme.primary)
          Text("显示颜色", style = MaterialTheme.typography.labelLarge)
        }
        FlowRow(horizontalArrangement = Arrangement.spacedBy(11.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
          categoryPresetColors.forEach { color ->
            Surface(
              modifier = Modifier.size(28.dp).clickable(enabled = enabled) {
                onDraftChange(draft.copy(color = color, colorManuallyEdited = true))
              },
              shape = CircleShape,
              color = parseSettingsCategoryColor(color),
              border = if (draft.color == color) BorderStroke(2.dp, MaterialTheme.colorScheme.onSurface) else BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.25f)),
            ) {}
          }
        }
      }
    }
  }
}

internal fun parseSettingsCategoryColor(value: String?): Color =
  runCatching { Color((value ?: categoryPresetColors.first()).toColorInt()) }
    .getOrDefault(Color.Unspecified)

internal fun isCategoryHexColor(value: String): Boolean = value.matches(Regex("^#[0-9A-Fa-f]{6}$"))
