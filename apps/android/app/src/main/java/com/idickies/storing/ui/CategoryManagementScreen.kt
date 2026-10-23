package com.idickies.storing.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.Orientation
import androidx.compose.foundation.gestures.draggable
import androidx.compose.foundation.gestures.rememberDraggableState
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
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.DeleteOutline
import androidx.compose.material.icons.outlined.DragHandle
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.outlined.FolderOpen
import androidx.compose.material.icons.outlined.KeyboardArrowDown
import androidx.compose.material.icons.outlined.KeyboardArrowUp
import androidx.compose.material.icons.automirrored.outlined.MergeType
import androidx.compose.material.icons.outlined.PauseCircleOutline
import androidx.compose.material.icons.outlined.PlayCircleOutline
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.idickies.storing.categories.CategoryManagementUiState
import com.idickies.storing.categories.CategoryManagementViewModel
import com.idickies.storing.categories.activeCategories
import com.idickies.storing.categories.categorySearchAction
import com.idickies.storing.categories.isValidCategoryName
import com.idickies.storing.categories.moveUserCategory
import com.idickies.storing.categories.searchCategories
import com.idickies.storing.categories.CategorySearchAction
import com.idickies.storing.library.ArticleCategory
import com.idickies.storing.library.CategoryMutationRequest
import com.idickies.storing.library.CategoryOptimizeDraft
import com.idickies.storing.library.CategoryOptimizeRequest
import kotlin.math.abs
import kotlinx.coroutines.launch

@Composable
fun CategoryManagementScreen(
  onBack: () -> Unit,
  viewModel: CategoryManagementViewModel = hiltViewModel(),
) {
  val state by viewModel.state.collectAsState()
  CategoryManagementContent(
    state = state,
    onBack = onBack,
    onRefresh = viewModel::refresh,
    onCreate = { draft, done -> viewModel.create(draft.toMutationRequest(), done) },
    onUpdate = { category, draft, done -> viewModel.update(category.id, draft.toMutationRequest(), done) },
    onToggleActive = { category -> viewModel.update(category.id, CategoryMutationRequest(isActive = !category.isActive)) {} },
    onDelete = { category, targetId, done -> viewModel.delete(category.id, targetId, done) },
    onReorder = viewModel::reorder,
    onMerge = { sourceId, targetId, done -> viewModel.merge(sourceId, targetId, done) },
    onOptimize = viewModel::optimize,
    onNoticeShown = viewModel::dismissNotice,
  )
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun CategoryManagementContent(
  state: CategoryManagementUiState,
  onBack: () -> Unit,
  onRefresh: () -> Unit,
  onCreate: (CategoryQuickCreateDraft, (Boolean) -> Unit) -> Unit,
  onUpdate: (ArticleCategory, CategoryQuickCreateDraft, (Boolean) -> Unit) -> Unit,
  onToggleActive: (ArticleCategory) -> Unit,
  onDelete: (ArticleCategory, Int, (Boolean) -> Unit) -> Unit,
  onReorder: (List<Int>) -> Unit,
  onMerge: (Int, Int, (Boolean) -> Unit) -> Unit,
  onOptimize: (CategoryOptimizeRequest, (CategoryOptimizeDraft?) -> Unit) -> Unit,
  onNoticeShown: () -> Unit,
) {
  var query by rememberSaveable { mutableStateOf("") }
  var selectedCategoryId by rememberSaveable { mutableStateOf<Int?>(null) }
  var createOpen by remember { mutableStateOf(false) }
  var deleteCategory by remember { mutableStateOf<ArticleCategory?>(null) }
  var mergeSource by remember { mutableStateOf<ArticleCategory?>(null) }
  val snackbarHostState = remember { SnackbarHostState() }
  val selected = state.categories.firstOrNull { it.id == selectedCategoryId }
  val filtered = searchCategories(state.categories, query)

  BackHandler(onBack = onBack)
  LaunchedEffect(state.notice) {
    state.notice?.let {
      snackbarHostState.showSnackbar(it)
      onNoticeShown()
    }
  }
  Scaffold(
    topBar = {
      TopAppBar(
        colors = TopAppBarDefaults.topAppBarColors(containerColor = MaterialTheme.colorScheme.surfaceVariant),
        title = { Text("分类管理") },
        navigationIcon = {
          IconButton(onClick = onBack) {
            Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "返回资料库")
          }
        },
        actions = {
          IconButton(onClick = { createOpen = true }, enabled = !state.saving) {
            Icon(Icons.Outlined.Add, contentDescription = "新增分类")
          }
        },
      )
    },
    snackbarHost = { SnackbarHost(snackbarHostState) },
  ) { padding ->
    LazyColumn(
      modifier = Modifier.fillMaxSize().padding(padding),
      contentPadding = PaddingValues(horizontal = 16.dp, vertical = 16.dp),
      verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
      item {
        OutlinedTextField(
          value = query,
          onValueChange = { query = it },
          label = { Text("搜索分类") },
          leadingIcon = { Icon(Icons.Outlined.Search, contentDescription = null) },
          singleLine = true,
          modifier = Modifier.fillMaxWidth(),
        )
      }
      item {
        Surface(color = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.46f), shape = MaterialTheme.shapes.large) {
          Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(7.dp)) {
            Text("分类只用于组织已归档文章", style = MaterialTheme.typography.titleSmall)
            Text("文章归档时即可选择分类；系统分类固定，用户分类可按拖拽手柄排序。", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
            TextButton(onClick = { createOpen = true }, enabled = !state.saving) {
              Icon(Icons.Outlined.Add, contentDescription = null, modifier = Modifier.size(16.dp))
              Spacer(Modifier.width(4.dp))
              Text("新增分类")
            }
          }
        }
      }
      state.error?.let { error ->
        item {
          Surface(color = MaterialTheme.colorScheme.errorContainer, shape = MaterialTheme.shapes.medium) {
            Row(modifier = Modifier.fillMaxWidth().padding(12.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
              Icon(Icons.Outlined.ErrorOutline, contentDescription = null, tint = MaterialTheme.colorScheme.onErrorContainer)
              Text(error, modifier = Modifier.weight(1f), color = MaterialTheme.colorScheme.onErrorContainer, style = MaterialTheme.typography.bodySmall)
              TextButton(onClick = onRefresh) { Text("重试") }
            }
          }
        }
      }
      if (state.loading && state.categories.isEmpty()) {
        item {
          Row(modifier = Modifier.fillMaxWidth().padding(24.dp), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
            CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
            Spacer(Modifier.width(9.dp))
            Text("正在加载分类…", color = MaterialTheme.colorScheme.onSurfaceVariant)
          }
        }
      }
      if (filtered.isEmpty() && !state.loading) {
        item { CategoryManagementEmptyState(onCreate = { createOpen = true }) }
      }
      items(filtered, key = { it.id }) { category ->
        val fullIndex = state.categories.indexOfFirst { it.id == category.id }
        CategoryListRow(
          category = category,
          articleCount = state.counts[category.id.toString()] ?: 0,
          canMoveUp = !category.isSystem && fullIndex > 0 && !state.categories[fullIndex - 1].isSystem,
          canMoveDown = !category.isSystem && fullIndex in 0 until state.categories.lastIndex && !state.categories[fullIndex + 1].isSystem,
          saving = state.saving,
          onClick = { selectedCategoryId = category.id },
          onMove = { offset -> moveCategory(state.categories, category, offset)?.let(onReorder) },
        )
      }
    }
  }

  if (createOpen) {
    CategoryCreateSheet(
      saving = state.saving,
      error = state.error,
      existingCategories = state.categories,
      onDismiss = { if (!state.saving) createOpen = false },
      onCreate = onCreate,
      onOptimize = onOptimize,
      onUseExisting = { category ->
        createOpen = false
        selectedCategoryId = category.id
      },
    )
  }
  selected?.let { category ->
    CategoryDetailSheet(
      category = category,
      articleCount = state.counts[category.id.toString()] ?: 0,
      saving = state.saving,
      error = state.error,
      onDismiss = { if (!state.saving) selectedCategoryId = null },
      onUpdate = { draft, done -> onUpdate(category, draft, done) },
      onToggleActive = { onToggleActive(category) },
      onDelete = {
        selectedCategoryId = null
        deleteCategory = category
      },
      onMerge = {
        selectedCategoryId = null
        mergeSource = category
      },
      onOptimize = onOptimize,
    )
  }
  deleteCategory?.let { category ->
    CategoryDeleteSheet(
      category = category,
      categories = state.categories,
      saving = state.saving,
      onDismiss = { if (!state.saving) deleteCategory = null },
      onDelete = { targetId -> onDelete(category, targetId) { success -> if (success) deleteCategory = null } },
    )
  }
  mergeSource?.let { source ->
    CategoryMergeSheet(
      source = source,
      categories = state.categories,
      saving = state.saving,
      onDismiss = { if (!state.saving) mergeSource = null },
      onMerge = { targetId -> onMerge(source.id, targetId) { success -> if (success) mergeSource = null } },
    )
  }
}

@Composable
private fun CategoryListRow(
  category: ArticleCategory,
  articleCount: Int,
  canMoveUp: Boolean,
  canMoveDown: Boolean,
  saving: Boolean,
  onClick: () -> Unit,
  onMove: (Int) -> Unit,
) {
  val dragDistance = remember { mutableFloatStateOf(0f) }
  val dragState = rememberDraggableState { delta ->
    dragDistance.floatValue += delta
    if (abs(dragDistance.floatValue) >= 34f) {
      onMove(if (dragDistance.floatValue > 0) 1 else -1)
      dragDistance.floatValue = 0f
    }
  }
  Card(
    modifier = Modifier.fillMaxWidth().clickable(onClick = onClick),
    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceVariant.copy(alpha = if (category.isActive) 0.72f else 0.46f)),
    border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.28f)),
  ) {
    Row(
      modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp, vertical = 11.dp),
      verticalAlignment = Alignment.CenterVertically,
      horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) {
      if (category.isSystem) {
        Spacer(Modifier.width(24.dp))
      } else {
        Box(
          modifier = Modifier.size(32.dp).draggable(dragState, Orientation.Vertical),
          contentAlignment = Alignment.Center,
        ) {
          Icon(Icons.Outlined.DragHandle, contentDescription = "拖动排序：${category.name}", tint = MaterialTheme.colorScheme.onSurfaceVariant)
        }
      }
      Box(Modifier.size(10.dp).background(parseSettingsCategoryColor(category.color), androidx.compose.foundation.shape.CircleShape))
      Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
          Text(category.name, maxLines = 1, overflow = TextOverflow.Ellipsis, style = MaterialTheme.typography.titleSmall)
          if (category.isSystem) Text("系统", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
        }
        Text(
          buildString {
            append("$articleCount 篇")
            if (!category.isActive) append(" · 已停用")
          },
          style = MaterialTheme.typography.labelSmall,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
      }
      if (!category.isSystem) {
        IconButton(onClick = { onMove(-1) }, enabled = canMoveUp && !saving) {
          Icon(Icons.Outlined.KeyboardArrowUp, contentDescription = "上移 ${category.name}")
        }
        IconButton(onClick = { onMove(1) }, enabled = canMoveDown && !saving) {
          Icon(Icons.Outlined.KeyboardArrowDown, contentDescription = "下移 ${category.name}")
        }
      }
    }
  }
}

private fun moveCategory(categories: List<ArticleCategory>, category: ArticleCategory, offset: Int): List<Int>? {
  val index = categories.indexOfFirst { it.id == category.id }
  val target = categories.getOrNull(index + offset) ?: return null
  return moveUserCategory(categories, category.id, target.id)
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CategoryCreateSheet(
  saving: Boolean,
  error: String?,
  existingCategories: List<ArticleCategory>,
  onDismiss: () -> Unit,
  onCreate: (CategoryQuickCreateDraft, (Boolean) -> Unit) -> Unit,
  onUseExisting: (ArticleCategory) -> Unit,
  onOptimize: (CategoryOptimizeRequest, (CategoryOptimizeDraft?) -> Unit) -> Unit,
) {
  var draft by remember { mutableStateOf(CategoryQuickCreateDraft()) }
  var expanded by rememberSaveable { mutableStateOf(false) }
  var localError by remember { mutableStateOf<String?>(null) }
  val exact = when (val action = categorySearchAction(activeCategories(existingCategories), draft.name)) {
    is CategorySearchAction.UseExisting -> action.category
    else -> null
  }
  val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
  ModalBottomSheet(onDismissRequest = { if (!saving) onDismiss() }, sheetState = sheetState) {
    LazyColumn(
      modifier = Modifier.fillMaxWidth().heightIn(max = 720.dp).padding(horizontal = 20.dp),
      contentPadding = PaddingValues(bottom = 32.dp),
      verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
      item { Text("新增分类", style = MaterialTheme.typography.titleLarge) }
      item {
        CategoryQuickCreateFields(
          draft = draft,
          expanded = expanded,
          enabled = !saving,
          errorMessage = localError ?: error,
          onDraftChange = { draft = it; localError = null },
          onExpandedChange = { expanded = it },
          onOptimize = {
            onOptimize(
              CategoryOptimizeRequest(
                name = draft.name.trim(),
                description = draft.description.trim().ifBlank { null },
                includeExamples = draft.includeExamples.lines().map(String::trim).filter(String::isNotBlank),
                excludeExamples = draft.excludeExamples.lines().map(String::trim).filter(String::isNotBlank),
              ),
            ) { optimized ->
              optimized?.let { applyOptimizedDraft(draft, it).let { next -> draft = next } }
            }
          },
          optimizing = saving,
        )
      }
      if (exact != null) {
        item {
          Surface(color = MaterialTheme.colorScheme.secondaryContainer, shape = MaterialTheme.shapes.medium) {
            TextButton(onClick = { onUseExisting(exact) }, modifier = Modifier.fillMaxWidth()) {
              Text("使用现有分类「${exact.name}」")
            }
          }
        }
      }
      item {
        Button(
          onClick = {
            val request = draft.toMutationRequest()
            if (!isValidCategoryName(request.name.orEmpty())) {
              localError = "请输入 1 至 40 个字符的分类名称"
              return@Button
            }
            onCreate(draft) { success ->
              if (success) onDismiss() else localError = "分类未创建，请检查名称或稍后重试"
            }
          },
          enabled = !saving && exact == null && isValidCategoryName(draft.name),
          modifier = Modifier.fillMaxWidth(),
        ) {
          if (saving) CircularProgressIndicator(modifier = Modifier.size(17.dp), strokeWidth = 2.dp) else Icon(Icons.Outlined.Add, contentDescription = null, modifier = Modifier.size(17.dp))
          Spacer(Modifier.width(6.dp))
          Text(if (saving) "创建中…" else "创建分类")
        }
      }
    }
  }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CategoryDetailSheet(
  category: ArticleCategory,
  articleCount: Int,
  saving: Boolean,
  error: String?,
  onDismiss: () -> Unit,
  onUpdate: (CategoryQuickCreateDraft, (Boolean) -> Unit) -> Unit,
  onToggleActive: () -> Unit,
  onDelete: () -> Unit,
  onMerge: () -> Unit,
  onOptimize: (CategoryOptimizeRequest, (CategoryOptimizeDraft?) -> Unit) -> Unit,
) {
  var draft by remember(category.id) {
    mutableStateOf(
      CategoryQuickCreateDraft(
        name = category.name,
        description = category.description.orEmpty(),
        includeExamples = category.includeExamples.joinToString("\n"),
        excludeExamples = category.excludeExamples.joinToString("\n"),
        color = category.color ?: com.idickies.storing.categories.stableCategoryColor(category.name),
        colorManuallyEdited = true,
      ),
    )
  }
  var localError by remember(category.id) { mutableStateOf<String?>(null) }
  val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
  ModalBottomSheet(onDismissRequest = { if (!saving) onDismiss() }, sheetState = sheetState) {
    LazyColumn(
      modifier = Modifier.fillMaxWidth().heightIn(max = 760.dp).padding(horizontal = 20.dp),
      contentPadding = PaddingValues(bottom = 32.dp),
      verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
      item {
        Column(verticalArrangement = Arrangement.spacedBy(3.dp)) {
          Text("分类详情", style = MaterialTheme.typography.titleLarge)
          Text("${category.name} · $articleCount 篇归档文章", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
        }
      }
      if (category.isSystem) {
        item {
          Surface(color = MaterialTheme.colorScheme.secondaryContainer, shape = MaterialTheme.shapes.medium) {
            Column(modifier = Modifier.padding(14.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
              Text("系统分类固定，不能编辑、停用或删除。", style = MaterialTheme.typography.titleSmall)
              Text(category.description ?: "用于接收 AI 无法明确归类的归档文章。", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
            }
          }
        }
      } else {
        item {
          CategoryQuickCreateFields(
            draft = draft,
            expanded = true,
            enabled = !saving,
            errorMessage = localError ?: error,
            onDraftChange = { draft = it; localError = null },
            onExpandedChange = {},
            showDetailsToggle = false,
            onOptimize = {
              onOptimize(
                CategoryOptimizeRequest(
                  name = draft.name.trim(),
                  description = draft.description.trim().ifBlank { null },
                  includeExamples = draft.includeExamples.lines().map(String::trim).filter(String::isNotBlank),
                  excludeExamples = draft.excludeExamples.lines().map(String::trim).filter(String::isNotBlank),
                ),
              ) { optimized ->
                optimized?.let { applyOptimizedDraft(draft, it)?.let { next -> draft = next } }
              }
            },
            optimizing = saving,
          )
        }
        item {
          Button(
            onClick = {
              onUpdate(draft) { success ->
                if (!success) localError = "保存失败，输入内容已保留"
              }
            },
            enabled = !saving && isValidCategoryName(draft.name),
            modifier = Modifier.fillMaxWidth(),
          ) { Text(if (saving) "保存中…" else "保存修改") }
        }
        item {
          Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            TextButton(onClick = onMerge, enabled = !saving) {
              Icon(Icons.AutoMirrored.Outlined.MergeType, contentDescription = null, modifier = Modifier.size(17.dp))
              Spacer(Modifier.width(4.dp))
              Text("合并分类")
            }
            TextButton(onClick = onToggleActive, enabled = !saving) {
              Icon(if (category.isActive) Icons.Outlined.PauseCircleOutline else Icons.Outlined.PlayCircleOutline, contentDescription = null, modifier = Modifier.size(17.dp))
              Spacer(Modifier.width(4.dp))
              Text(if (category.isActive) "停用" else "重新启用")
            }
            TextButton(onClick = onDelete, enabled = !saving) {
              Icon(Icons.Outlined.DeleteOutline, contentDescription = null, tint = MaterialTheme.colorScheme.error, modifier = Modifier.size(17.dp))
              Spacer(Modifier.width(4.dp))
              Text("删除", color = MaterialTheme.colorScheme.error)
            }
          }
        }
      }
    }
  }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CategoryDeleteSheet(
  category: ArticleCategory,
  categories: List<ArticleCategory>,
  saving: Boolean,
  onDismiss: () -> Unit,
  onDelete: (Int) -> Unit,
) {
  val targets = activeCategories(categories).filter { it.id != category.id }
  var targetId by remember(category.id) { mutableStateOf(targets.firstOrNull()?.id) }
  ModalBottomSheet(onDismissRequest = { if (!saving) onDismiss() }) {
    Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 22.dp).padding(bottom = 32.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
      Text("删除“${category.name}”", style = MaterialTheme.typography.titleLarge)
      Text("删除前，需要将现有文章迁移到另一个启用分类。", color = MaterialTheme.colorScheme.onSurfaceVariant)
      targets.forEach { target ->
        Surface(
          modifier = Modifier.fillMaxWidth().clickable(enabled = !saving) { targetId = target.id },
          shape = MaterialTheme.shapes.medium,
          color = if (targetId == target.id) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceVariant,
          border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.35f)),
        ) { Text(target.name, modifier = Modifier.padding(12.dp)) }
      }
      if (targets.isEmpty()) Text("至少需要保留一个其他启用分类才能删除。", color = MaterialTheme.colorScheme.error)
      Button(onClick = { targetId?.let(onDelete) }, enabled = targetId != null && !saving, modifier = Modifier.fillMaxWidth()) {
        Text(if (saving) "正在删除…" else "迁移并删除")
      }
    }
  }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun CategoryMergeSheet(
  source: ArticleCategory,
  categories: List<ArticleCategory>,
  saving: Boolean,
  onDismiss: () -> Unit,
  onMerge: (Int) -> Unit,
) {
  val targets = activeCategories(categories).filter { it.id != source.id }
  var targetId by remember(source.id) { mutableStateOf(targets.firstOrNull()?.id) }
  ModalBottomSheet(onDismissRequest = { if (!saving) onDismiss() }) {
    Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 22.dp).padding(bottom = 32.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
      Text("合并分类", style = MaterialTheme.typography.titleLarge)
      Text("将“${source.name}”的文章移入目标分类；源分类会被停用。", color = MaterialTheme.colorScheme.onSurfaceVariant)
      targets.forEach { target ->
        Surface(
          modifier = Modifier.fillMaxWidth().clickable(enabled = !saving) { targetId = target.id },
          shape = MaterialTheme.shapes.medium,
          color = if (targetId == target.id) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceVariant,
          border = BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.35f)),
        ) { Text(target.name, modifier = Modifier.padding(12.dp)) }
      }
      Button(onClick = { targetId?.let(onMerge) }, enabled = targetId != null && !saving, modifier = Modifier.fillMaxWidth()) {
        Text(if (saving) "正在合并…" else "合并到所选分类")
      }
    }
  }
}

@Composable
private fun CategoryManagementEmptyState(onCreate: () -> Unit) {
  Surface(color = MaterialTheme.colorScheme.surfaceVariant, shape = MaterialTheme.shapes.large) {
    Column(modifier = Modifier.fillMaxWidth().padding(24.dp), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
      Icon(Icons.Outlined.FolderOpen, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
      Text("没有匹配的分类", style = MaterialTheme.typography.titleMedium)
      Text("可以创建新分类，或清空搜索条件。", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
      Button(onClick = onCreate) { Text("新增分类") }
    }
  }
}

private fun applyOptimizedDraft(
  draft: CategoryQuickCreateDraft,
  optimized: CategoryOptimizeDraft,
): CategoryQuickCreateDraft = draft.copy(
  description = optimized.description ?: draft.description,
  includeExamples = optimized.includeExamples.takeIf { it.isNotEmpty() }?.joinToString("\n") ?: draft.includeExamples,
  excludeExamples = optimized.excludeExamples.takeIf { it.isNotEmpty() }?.joinToString("\n") ?: draft.excludeExamples,
)
