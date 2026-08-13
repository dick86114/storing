package com.idickies.storing.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.DeleteOutline
import androidx.compose.material.icons.outlined.Edit
import androidx.compose.material.icons.outlined.KeyboardArrowDown
import androidx.compose.material.icons.outlined.KeyboardArrowUp
import androidx.compose.material.icons.outlined.PauseCircleOutline
import androidx.compose.material.icons.outlined.PlayCircleOutline
import androidx.compose.material.icons.outlined.Palette
import androidx.compose.material.icons.outlined.RocketLaunch
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.FolderOpen
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.idickies.storing.categories.CategoryManagementViewModel
import com.idickies.storing.library.ArticleCategory
import com.idickies.storing.library.CategoryMutationRequest
import com.idickies.storing.library.CategoryOptimizeRequest

private data class CategoryFormDraft(
  val name: String = "",
  val description: String = "",
  val includeExamples: String = "",
  val excludeExamples: String = "",
  val color: String = categoryPresetColors.first(),
)

internal val categoryPresetColors = listOf(
  "#2F6A4F", "#3E7C83", "#536CCB", "#8A5A9E", "#B36A45", "#A67C38",
  "#647B4D", "#2F7780", "#6675B7", "#A16078", "#9B7250", "#6B7088",
)
internal const val categoryAiOptimizeLabel = "AI 优化"
internal const val categoryRuleHelpText = "适合收录用于描述典型主题、文章类型或问题场景；不适合收录用于说明容易混淆、但应归入其他分类的内容。每行一个例子，越具体越有助于 AI 判断。"

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun CategoryManagementScreen(
  onBack: () -> Unit,
  viewModel: CategoryManagementViewModel = hiltViewModel(),
) {
  val state by viewModel.state.collectAsState()
  var editingCategory by remember { mutableStateOf<ArticleCategory?>(null) }
  var createOpen by remember { mutableStateOf(false) }
  var deleteCategory by remember { mutableStateOf<ArticleCategory?>(null) }
  var deleteTargetId by remember { mutableStateOf<Int?>(null) }
  val categories = state.categories

  BackHandler(onBack = onBack)
  Scaffold(
    topBar = {
      TopAppBar(
        colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
        title = { Text("分类管理") },
        navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "返回设置") } },
        actions = { IconButton(onClick = { createOpen = true }, enabled = !state.saving) { Icon(Icons.Outlined.Add, contentDescription = "新增分类") } },
      )
    },
  ) { padding ->
    LazyColumn(
      modifier = Modifier.fillMaxSize().padding(padding),
      contentPadding = PaddingValues(horizontal = 16.dp, vertical = 18.dp),
      verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
      item { CategoryManagementIntro(categories.size, onCreate = { createOpen = true }) }
      if (state.error != null) item { Text(state.error!!, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall) }
      categories.forEachIndexed { index, category ->
        item(key = category.id) {
          CategoryManagementCard(
            category = category,
            articleCount = state.counts[category.id.toString()] ?: 0,
            canMoveUp = index > 0,
            canMoveDown = index < categories.lastIndex,
            saving = state.saving,
            onEdit = { editingCategory = category },
            onToggleActive = {
              viewModel.update(category.id, CategoryMutationRequest(isActive = !category.isActive)) {}
            },
            onDelete = {
              deleteCategory = category
              deleteTargetId = categories.firstOrNull { it.id != category.id && it.isActive }?.id
            },
            onMove = { offset ->
              val reordered = categories.map { it.id }.toMutableList()
              val target = index + offset
              val current = reordered.removeAt(index)
              reordered.add(target, current)
              viewModel.reorder(reordered)
            },
          )
        }
      }
      if (!state.loading && categories.isEmpty()) item {
        CategoryManagementEmptyState(onCreate = { createOpen = true })
      }
    }
  }
  if (createOpen || editingCategory != null) {
    CategoryEditDialog(
      category = editingCategory,
      saving = state.saving,
      onDismiss = { createOpen = false; editingCategory = null },
      onOptimize = { request, onComplete -> viewModel.optimize(request, onComplete) },
      onSave = { request ->
        if (editingCategory == null) viewModel.create(request) { success -> if (success) createOpen = false }
        else viewModel.update(editingCategory!!.id, request) { success -> if (success) editingCategory = null }
      },
    )
  }
  deleteCategory?.let { category ->
    val targets = categories.filter { it.id != category.id && it.isActive }
    QiankunjieAlertDialog(
      onDismissRequest = { if (!state.saving) deleteCategory = null },
      icon = { Icon(Icons.Outlined.DeleteOutline, contentDescription = null, tint = MaterialTheme.colorScheme.error) },
      title = { Text("删除“${category.name}”") },
      text = {
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
          Text("删除前，需要将现有文章迁移到另一个启用分类。", color = MaterialTheme.colorScheme.onSurfaceVariant)
          targets.forEach { target ->
            Surface(
              modifier = Modifier.fillMaxWidth().clickable(enabled = !state.saving) { deleteTargetId = target.id },
              shape = MaterialTheme.shapes.small,
              color = if (deleteTargetId == target.id) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surface,
              border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.42f)),
            ) { Text(target.name, modifier = Modifier.padding(12.dp), color = MaterialTheme.colorScheme.onSurface) }
          }
          if (targets.isEmpty()) Text("至少需要保留一个其他启用分类才能删除。", color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
        }
      },
      dismissButton = { TextButton(onClick = { deleteCategory = null }, enabled = !state.saving) { Text("取消") } },
      confirmButton = {
        Button(
          onClick = { deleteTargetId?.let { targetId -> viewModel.delete(category.id, targetId) { success -> if (success) deleteCategory = null } } },
          enabled = deleteTargetId != null && !state.saving,
        ) { Text(if (state.saving) "正在删除…" else "迁移并删除") }
      },
    )
  }
}

@Composable
private fun CategoryManagementIntro(categoryCount: Int, onCreate: () -> Unit) {
  Surface(
    color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.58f),
    shape = MaterialTheme.shapes.large,
    border = BorderStroke(1.dp, MaterialTheme.colorScheme.primary.copy(alpha = 0.18f)),
  ) {
    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
      Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Icon(Icons.Outlined.AutoAwesome, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(18.dp))
        Text("建立归档边界", style = MaterialTheme.typography.titleMedium)
        if (categoryCount > 0) Text("$categoryCount 个分类", style = MaterialTheme.typography.labelMedium, color = MaterialTheme.colorScheme.primary)
      }
      Text("分类决定归档文章的长期归属，AI 只会从已启用的分类中选择。", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
      TextButton(onClick = onCreate, modifier = Modifier.align(Alignment.End)) {
        Icon(Icons.Outlined.Add, contentDescription = null, modifier = Modifier.size(17.dp))
        Spacer(Modifier.width(4.dp))
        Text("新增分类")
      }
    }
  }
}

@Composable
private fun CategoryManagementEmptyState(onCreate: () -> Unit) {
  Surface(
    modifier = Modifier.fillMaxWidth(),
    color = MaterialTheme.colorScheme.surfaceVariant,
    shape = MaterialTheme.shapes.large,
    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.35f)),
  ) {
    Column(
      modifier = Modifier.padding(horizontal = 22.dp, vertical = 28.dp),
      horizontalAlignment = Alignment.CenterHorizontally,
      verticalArrangement = Arrangement.spacedBy(9.dp),
    ) {
      Icon(Icons.Outlined.FolderOpen, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(30.dp))
      Text("还没有分类", style = MaterialTheme.typography.titleMedium)
      Text("先建立一个让 AI 可以遵循的归档边界。", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
      Button(onClick = onCreate) { Icon(Icons.Outlined.Add, contentDescription = null); Spacer(Modifier.width(5.dp)); Text("新增分类") }
    }
  }
}

@Composable
private fun CategoryManagementCard(
  category: ArticleCategory,
  articleCount: Int,
  canMoveUp: Boolean,
  canMoveDown: Boolean,
  saving: Boolean,
  onEdit: () -> Unit,
  onToggleActive: () -> Unit,
  onDelete: () -> Unit,
  onMove: (Int) -> Unit,
) {
  Card(
    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = if (category.isActive) 0.42f else 0.24f)),
  ) {
    Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(11.dp)) {
      Row(verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(10.dp).background(parseSettingsCategoryColor(category.color), androidx.compose.foundation.shape.CircleShape))
        Spacer(Modifier.width(9.dp))
        Text(category.name, modifier = Modifier.weight(1f), style = MaterialTheme.typography.titleMedium, maxLines = 1, overflow = TextOverflow.Ellipsis)
        if (category.isSystem) Text("系统", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
        else if (!category.isActive) Text("已停用", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
      }
      Text(category.description ?: "尚未设置分类说明，AI 会优先将不明确的文章归入待整理。", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall, maxLines = 2, overflow = TextOverflow.Ellipsis)
      Column(verticalArrangement = Arrangement.spacedBy(5.dp)) {
        CategoryRuleLine("适合", category.includeExamples.take(2).joinToString("、").ifBlank { "尚未定义" })
        CategoryRuleLine("排除", category.excludeExamples.take(2).joinToString("、").ifBlank { "尚未定义" })
      }
      Row(verticalAlignment = Alignment.CenterVertically) {
        Icon(Icons.Outlined.FolderOpen, contentDescription = null, modifier = Modifier.size(15.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
        Spacer(Modifier.width(5.dp))
        Text("$articleCount 篇归档文章", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelSmall)
      }
      Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End, verticalAlignment = Alignment.CenterVertically) {
        if (canMoveUp) IconButton(onClick = { onMove(-1) }, enabled = !saving) { Icon(Icons.Outlined.KeyboardArrowUp, contentDescription = "上移") }
        if (canMoveDown) IconButton(onClick = { onMove(1) }, enabled = !saving) { Icon(Icons.Outlined.KeyboardArrowDown, contentDescription = "下移") }
        if (!category.isSystem) {
          IconButton(onClick = onEdit, enabled = !saving) { Icon(Icons.Outlined.Edit, contentDescription = "编辑") }
          IconButton(onClick = onToggleActive, enabled = !saving) {
            Icon(if (category.isActive) Icons.Outlined.PauseCircleOutline else Icons.Outlined.PlayCircleOutline, contentDescription = if (category.isActive) "停用" else "重新启用")
          }
          IconButton(onClick = onDelete, enabled = !saving) { Icon(Icons.Outlined.DeleteOutline, contentDescription = "删除", tint = MaterialTheme.colorScheme.error) }
        }
      }
    }
  }
}

@Composable
private fun CategoryRuleLine(label: String, value: String) {
  Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(9.dp)) {
    Text(label, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelSmall, modifier = Modifier.width(28.dp))
    Text(value, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelSmall, maxLines = 1, overflow = TextOverflow.Ellipsis)
  }
}

@Composable
private fun CategoryEditDialog(
  category: ArticleCategory?,
  saving: Boolean,
  onDismiss: () -> Unit,
  onOptimize: (CategoryOptimizeRequest, (com.idickies.storing.library.CategoryOptimizeDraft?) -> Unit) -> Unit,
  onSave: (CategoryMutationRequest) -> Unit,
) {
  var draft by remember(category?.id) {
    mutableStateOf(CategoryFormDraft(
      name = category?.name.orEmpty(),
      description = category?.description.orEmpty(),
      includeExamples = category?.includeExamples?.joinToString("\n").orEmpty(),
      excludeExamples = category?.excludeExamples?.joinToString("\n").orEmpty(),
      color = category?.color ?: categoryPresetColors.first(),
    ))
  }
  QiankunjieAlertDialog(
    onDismissRequest = { if (!saving) onDismiss() },
    title = { Text(if (category == null) "新增分类" else "编辑分类") },
    text = {
      LazyColumn(
        modifier = Modifier.fillMaxWidth().heightIn(max = 560.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
      ) {
        item {
          OutlinedTextField(
            value = draft.name,
            onValueChange = { draft = draft.copy(name = it) },
            label = { Text("分类名称") },
            placeholder = { Text("例如：编程开发") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
          )
        }
        item {
          Column(verticalArrangement = Arrangement.spacedBy(7.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
              Text("分类说明", style = MaterialTheme.typography.labelLarge, modifier = Modifier.weight(1f))
              TextButton(
                onClick = {
                  onOptimize(
                    CategoryOptimizeRequest(
                      name = draft.name.trim(),
                      description = draft.description.trim().ifBlank { null },
                      includeExamples = draft.includeExamples.lines().map(String::trim).filter(String::isNotBlank),
                      excludeExamples = draft.excludeExamples.lines().map(String::trim).filter(String::isNotBlank),
                    ),
                  ) { optimized ->
                    optimized?.let {
                      draft = draft.copy(
                        description = it.description ?: draft.description,
                        includeExamples = it.includeExamples.takeIf { values -> values.isNotEmpty() }?.joinToString("\n") ?: draft.includeExamples,
                        excludeExamples = it.excludeExamples.takeIf { values -> values.isNotEmpty() }?.joinToString("\n") ?: draft.excludeExamples,
                      )
                    }
                  }
                },
                enabled = draft.name.isNotBlank() && !saving,
              ) {
                Icon(Icons.Outlined.AutoAwesome, contentDescription = null, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(4.dp))
                Text(if (saving) "正在优化…" else categoryAiOptimizeLabel)
              }
            }
            OutlinedTextField(
              value = draft.description,
              onValueChange = { draft = draft.copy(description = it) },
              placeholder = { Text("用一句话说明这个分类的长期归属边界。") },
              minLines = 3,
              modifier = Modifier.fillMaxWidth(),
            )
          }
        }
        item {
          Surface(color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.42f), shape = MaterialTheme.shapes.medium) {
            Row(modifier = Modifier.padding(11.dp), horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.Top) {
              Icon(Icons.Outlined.RocketLaunch, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(17.dp))
              Text(categoryRuleHelpText, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
          }
        }
        item {
          Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("适合收录", style = MaterialTheme.typography.labelLarge)
            Text("写典型主题、文章类型或问题场景，每行一个。", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            OutlinedTextField(value = draft.includeExamples, onValueChange = { draft = draft.copy(includeExamples = it) }, placeholder = { Text("Docker 部署与运维\n容器网络与镜像") }, minLines = 3, modifier = Modifier.fillMaxWidth())
          }
        }
        item {
          Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text("不适合收录", style = MaterialTheme.typography.labelLarge)
            Text("写容易混淆、但应归到其他分类的内容，每行一个。", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            OutlinedTextField(value = draft.excludeExamples, onValueChange = { draft = draft.copy(excludeExamples = it) }, placeholder = { Text("纯产品新闻\n个人生活随笔") }, minLines = 3, modifier = Modifier.fillMaxWidth())
          }
        }
        item {
          Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(7.dp)) {
              Icon(Icons.Outlined.Palette, contentDescription = null, modifier = Modifier.size(16.dp), tint = MaterialTheme.colorScheme.primary)
              Text("显示颜色", style = MaterialTheme.typography.labelLarge)
              Text("用于归档导航和文章分类标识", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            androidx.compose.foundation.layout.FlowRow(horizontalArrangement = Arrangement.spacedBy(11.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
              categoryPresetColors.forEach { color ->
                Surface(
                  modifier = Modifier.size(28.dp).clickable { draft = draft.copy(color = color) },
                  shape = androidx.compose.foundation.shape.CircleShape,
                  color = parseSettingsCategoryColor(color),
                  border = if (draft.color == color) BorderStroke(2.dp, MaterialTheme.colorScheme.onSurface) else BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.25f)),
                ) {}
              }
            }
            OutlinedTextField(
              value = draft.color,
              onValueChange = { value -> draft = draft.copy(color = value.uppercase()) },
              label = { Text("自定义颜色") },
              placeholder = { Text("#146C94") },
              singleLine = true,
              isError = draft.color.isNotBlank() && !isCategoryHexColor(draft.color),
              supportingText = {
                Text(if (draft.color.isBlank() || isCategoryHexColor(draft.color)) "输入 #RRGGBB 自定义颜色" else "请输入 6 位十六进制颜色")
              },
              modifier = Modifier.fillMaxWidth(),
            )
          }
        }
      }
    },
    dismissButton = { TextButton(onClick = onDismiss, enabled = !saving) { Text("取消") } },
    confirmButton = {
      Button(
        onClick = {
          onSave(CategoryMutationRequest(
            name = draft.name.trim(),
            description = draft.description.trim().ifBlank { null },
            includeExamples = draft.includeExamples.lines().map(String::trim).filter(String::isNotBlank),
            excludeExamples = draft.excludeExamples.lines().map(String::trim).filter(String::isNotBlank),
            color = draft.color,
          ))
        },
        enabled = draft.name.isNotBlank() && isCategoryHexColor(draft.color) && !saving,
      ) { Text(if (saving) "保存中…" else "保存") }
    },
  )
}

private fun parseSettingsCategoryColor(value: String?): Color = runCatching { Color(android.graphics.Color.parseColor(value ?: categoryPresetColors.first())) }.getOrDefault(Color.Unspecified)

internal fun isCategoryHexColor(value: String): Boolean = value.matches(Regex("^#[0-9A-Fa-f]{6}$"))
