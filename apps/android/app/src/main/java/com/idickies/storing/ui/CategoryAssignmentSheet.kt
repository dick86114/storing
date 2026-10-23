package com.idickies.storing.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Add
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.ErrorOutline
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameNanos
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.core.graphics.toColorInt
import com.idickies.storing.categories.CategoryCreationResult
import com.idickies.storing.categories.CategorySearchAction
import com.idickies.storing.categories.MAX_CATEGORY_NAME_LENGTH
import com.idickies.storing.categories.activeCategories
import com.idickies.storing.categories.categorySearchAction
import com.idickies.storing.categories.isValidCategoryName
import com.idickies.storing.categories.searchCategories
import com.idickies.storing.library.ArticleCategory
import com.idickies.storing.library.CategoryMutationRequest
import com.idickies.storing.library.CategoryAssignmentResult
import kotlinx.coroutines.launch

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun CategoryAssignmentSheet(
  title: String,
  subtitle: String,
  categories: List<ArticleCategory>,
  recentCategories: List<ArticleCategory>,
  currentCategoryId: Int?,
  targetCount: Int = 1,
  loading: Boolean = false,
  loadError: String? = null,
  onRetry: (() -> Unit)? = null,
  onDismissRequest: () -> Unit,
  onSelectAi: (() -> Unit)? = null,
  onAssign: suspend (categoryId: Int) -> CategoryAssignmentResult,
  onCreateCategory: suspend (request: CategoryMutationRequest) -> CategoryCreationResult,
  onAssigned: (message: String) -> Unit,
) {
  val available = activeCategories(categories)
  val sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true)
  val focusRequester = remember { FocusRequester() }
  val scope = rememberCoroutineScope()
  var query by rememberSaveable { mutableStateOf("") }
  var submitting by remember { mutableStateOf(false) }
  var resultMessage by remember { mutableStateOf<String?>(null) }
  var resultIsError by remember { mutableStateOf(false) }
  var rulesExpanded by rememberSaveable { mutableStateOf(false) }
  var quickDraft by remember { mutableStateOf(CategoryQuickCreateDraft()) }

  fun dismissIfPossible() {
    if (!submitting) onDismissRequest()
  }

  fun submitAssignment(category: ArticleCategory) {
    if (submitting || category.id == currentCategoryId) return
    submitting = true
    resultMessage = null
    scope.launch {
      val result = runCatching { onAssign(category.id) }
        .getOrElse { CategoryAssignmentResult.Failure(it.message ?: "分类失败") }
      submitting = false
      resultMessage = result.message
      resultIsError = !result.closesSheet
      if (result.closesSheet) {
        onAssigned(result.message)
        onDismissRequest()
      }
    }
  }

  fun createAndAssign(name: String) {
    if (submitting) return
    if (!isValidCategoryName(name)) {
      resultMessage = "分类名称需为 1 至 $MAX_CATEGORY_NAME_LENGTH 个字符"
      resultIsError = true
      return
    }
    submitting = true
    resultMessage = null
    scope.launch {
      val request = quickDraft.withName(name.trim()).toMutationRequest()
      when (val created = runCatching { onCreateCategory(request) }
        .getOrElse { CategoryCreationResult.Failed(it.message ?: "新增分类失败") }) {
        is CategoryCreationResult.Created -> {
          when (val assigned = runCatching { onAssign(created.category.id) }
            .getOrElse { CategoryAssignmentResult.Failure(it.message ?: "分类失败") }) {
            is CategoryAssignmentResult.Success -> {
              submitting = false
              onAssigned(assigned.message)
              onDismissRequest()
            }
            is CategoryAssignmentResult.Partial -> {
              submitting = false
              resultMessage = "分类「${created.category.name}」已创建；${assigned.message}"
              resultIsError = true
            }
            else -> {
              submitting = false
              val failure = CategoryAssignmentResult.CreatedButAssignmentFailed(created.category, assigned.message)
              resultMessage = failure.message
              resultIsError = true
            }
          }
        }
        is CategoryCreationResult.Existing -> {
          val assigned = runCatching { onAssign(created.category.id) }
            .getOrElse { CategoryAssignmentResult.Failure(it.message ?: "分类失败") }
          submitting = false
          if (assigned.closesSheet) {
            val prefix = if (created.recoveredFromConflict) "已恢复同名冲突并" else ""
            onAssigned(prefix + assigned.message)
            onDismissRequest()
          } else {
            resultMessage = assigned.message
            resultIsError = true
          }
        }
        is CategoryCreationResult.Failed -> {
          submitting = false
          resultMessage = created.message
          resultIsError = true
        }
      }
    }
  }

  fun submitSearch() {
    when (val action = categorySearchAction(available, query)) {
      is CategorySearchAction.UseExisting -> submitAssignment(action.category)
      is CategorySearchAction.Create -> createAndAssign(action.name)
      CategorySearchAction.None -> Unit
    }
  }

  BackHandler(enabled = !submitting) { onDismissRequest() }
  ModalBottomSheet(
    onDismissRequest = ::dismissIfPossible,
    sheetState = sheetState,
    containerColor = MaterialTheme.colorScheme.surface,
  ) {
    LazyColumn(
      modifier = Modifier
        .fillMaxWidth()
        .heightIn(max = 720.dp)
        .padding(horizontal = 20.dp)
        .onPreviewKeyEvent { event ->
          if (event.type == KeyEventType.KeyDown && event.key == Key.Escape && !submitting) {
            onDismissRequest()
            true
          } else {
            false
          }
        },
      verticalArrangement = Arrangement.spacedBy(10.dp),
      contentPadding = androidx.compose.foundation.layout.PaddingValues(bottom = 32.dp),
    ) {
      item {
        Row(verticalAlignment = Alignment.CenterVertically) {
          Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(title, style = MaterialTheme.typography.titleLarge)
            Text(
              if (targetCount > 1) "共 $targetCount 篇文章 · $subtitle" else subtitle,
              style = MaterialTheme.typography.bodySmall,
              color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
          }
          IconButton(onClick = ::dismissIfPossible, enabled = !submitting) {
            Icon(Icons.Outlined.Close, contentDescription = "关闭分类选择器")
          }
        }
      }
      item {
        Column {
          OutlinedTextField(
            value = query,
            onValueChange = {
              query = it.take(MAX_CATEGORY_NAME_LENGTH)
              quickDraft = quickDraft.withName(it)
              resultMessage = null
            },
            modifier = Modifier.fillMaxWidth().focusRequester(focusRequester),
            enabled = !submitting,
            label = { Text("搜索或输入新分类") },
            placeholder = { Text("按名称筛选分类") },
            leadingIcon = { Icon(Icons.Outlined.Search, contentDescription = null) },
            singleLine = true,
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Search),
            keyboardActions = KeyboardActions(onSearch = { submitSearch() }),
          )
          LaunchedEffect(Unit) {
            // 等输入框完成一次布局后再请求焦点，避免 ModalBottomSheet 首帧前崩溃。
            withFrameNanos { }
            focusRequester.requestFocus()
          }
        }
      }
      if (loadError != null) {
        item {
          Surface(color = MaterialTheme.colorScheme.errorContainer, shape = MaterialTheme.shapes.medium) {
            Row(
              modifier = Modifier.fillMaxWidth().padding(12.dp),
              verticalAlignment = Alignment.CenterVertically,
              horizontalArrangement = Arrangement.spacedBy(8.dp),
            ) {
              Icon(Icons.Outlined.ErrorOutline, contentDescription = null, tint = MaterialTheme.colorScheme.onErrorContainer)
              Text(loadError, modifier = Modifier.weight(1f), color = MaterialTheme.colorScheme.onErrorContainer, style = MaterialTheme.typography.bodySmall)
              onRetry?.let { TextButton(onClick = it, enabled = !submitting) { Text("重试") } }
            }
          }
        }
      }
      if (loading) {
        item {
          Row(modifier = Modifier.fillMaxWidth().padding(vertical = 18.dp), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
            CircularProgressIndicator(modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
            Spacer(Modifier.width(9.dp))
            Text("正在加载分类…", color = MaterialTheme.colorScheme.onSurfaceVariant)
          }
        }
      }
      onSelectAi?.let { selectAi ->
        item {
          CategoryAssignmentRow(
            label = "由 AI 判断",
            detail = "低置信度会进入待整理",
            icon = Icons.Outlined.AutoAwesome,
            selected = false,
            enabled = !submitting,
            onClick = {
              if (!submitting) {
                onDismissRequest()
                selectAi()
              }
            },
          )
        }
      }
      val filtered = searchCategories(available, query)
      if (query.isBlank()) {
        if (recentCategories.isNotEmpty()) {
          item { CategorySectionTitle("最近使用") }
          items(recentCategories, key = { "recent-${it.id}" }) { category ->
            CategoryAssignmentRow(
              label = category.name,
              color = category.color?.let(::parseCategoryColor) ?: MaterialTheme.colorScheme.primary,
              selected = category.id == currentCategoryId,
              enabled = !submitting,
              onClick = { submitAssignment(category) },
            )
          }
        }
        item { CategorySectionTitle("全部分类") }
        items(available, key = { "all-${it.id}" }) { category ->
          CategoryAssignmentRow(
            label = category.name,
            color = category.color?.let(::parseCategoryColor) ?: MaterialTheme.colorScheme.primary,
            selected = category.id == currentCategoryId,
            enabled = !submitting && category.id != currentCategoryId,
            onClick = { submitAssignment(category) },
          )
        }
      } else {
        item { CategorySectionTitle("匹配分类") }
        when (val action = categorySearchAction(available, query)) {
          is CategorySearchAction.UseExisting -> item {
            CategoryAssignmentRow(
              label = "使用现有分类「${action.category.name}」",
              color = action.category.color?.let(::parseCategoryColor) ?: MaterialTheme.colorScheme.primary,
              selected = action.category.id == currentCategoryId,
              enabled = !submitting && action.category.id != currentCategoryId,
              onClick = { submitAssignment(action.category) },
            )
          }
          else -> if (filtered.isEmpty()) item {
            Text("没有找到匹配分类。", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodySmall)
          }
        }
        items(filtered, key = { "match-${it.id}" }) { category ->
          CategoryAssignmentRow(
            label = category.name,
            color = category.color?.let(::parseCategoryColor) ?: MaterialTheme.colorScheme.primary,
            selected = category.id == currentCategoryId,
            enabled = !submitting && category.id != currentCategoryId,
            onClick = { submitAssignment(category) },
          )
        }
      }
      if (resultMessage != null) {
        item {
          Surface(
            color = if (resultIsError) MaterialTheme.colorScheme.errorContainer else MaterialTheme.colorScheme.secondaryContainer,
            shape = MaterialTheme.shapes.medium,
          ) {
            Text(
              resultMessage!!,
              modifier = Modifier.padding(12.dp),
              color = if (resultIsError) MaterialTheme.colorScheme.onErrorContainer else MaterialTheme.colorScheme.onSecondaryContainer,
              style = MaterialTheme.typography.bodySmall,
            )
          }
        }
      }
      if (!loading && query.isNotBlank() && isValidCategoryName(query) && categorySearchAction(available, query) !is CategorySearchAction.UseExisting) {
        if (rulesExpanded) {
          item {
            CategoryQuickCreateFields(
              draft = quickDraft,
              expanded = true,
              enabled = !submitting,
              errorMessage = null,
              onDraftChange = { quickDraft = it },
              onExpandedChange = { rulesExpanded = it },
              showDetailsToggle = false,
              showNameField = false,
            )
          }
        }
        item {
          Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            TextButton(onClick = { rulesExpanded = !rulesExpanded }, enabled = !submitting) {
              Text(if (rulesExpanded) "收起详细规则" else "详细规则（可选）")
            }
            Button(
              onClick = { createAndAssign(query) },
              enabled = !submitting,
              modifier = Modifier.fillMaxWidth(),
            ) {
              if (submitting) {
                CircularProgressIndicator(modifier = Modifier.size(17.dp), strokeWidth = 2.dp)
                Spacer(Modifier.width(8.dp))
              } else {
                Icon(Icons.Outlined.Add, contentDescription = null, modifier = Modifier.size(17.dp))
                Spacer(Modifier.width(6.dp))
              }
              Text("创建“${query.trim()}”并分类")
            }
          }
        }
      }
      if (available.isEmpty() && !loading && query.isBlank()) {
        item {
          TextButton(onClick = { focusRequester.requestFocus() }, modifier = Modifier.fillMaxWidth()) {
            Icon(Icons.Outlined.Add, contentDescription = null)
            Spacer(Modifier.width(5.dp))
            Text("创建第一个分类")
          }
        }
      }
    }
  }
}

@Composable
private fun CategorySectionTitle(label: String) {
  Text(
    label,
    modifier = Modifier.padding(top = 5.dp),
    style = MaterialTheme.typography.labelLarge,
    color = MaterialTheme.colorScheme.primary,
  )
}

@Composable
private fun CategoryAssignmentRow(
  label: String,
  selected: Boolean,
  enabled: Boolean,
  onClick: () -> Unit,
  color: Color? = null,
  icon: androidx.compose.ui.graphics.vector.ImageVector? = null,
  detail: String? = null,
) {
  Surface(
    modifier = Modifier.fillMaxWidth().clickable(enabled = enabled) { onClick() },
    shape = MaterialTheme.shapes.medium,
    color = if (selected) MaterialTheme.colorScheme.primaryContainer else MaterialTheme.colorScheme.surfaceVariant.copy(alpha = 0.56f),
    border = BorderStroke(
      1.dp,
      if (selected) MaterialTheme.colorScheme.primary.copy(alpha = 0.48f) else MaterialTheme.colorScheme.outline.copy(alpha = 0.3f),
    ),
  ) {
    Row(
      modifier = Modifier.padding(horizontal = 13.dp, vertical = 12.dp),
      horizontalArrangement = Arrangement.spacedBy(10.dp),
      verticalAlignment = Alignment.CenterVertically,
    ) {
      when {
        icon != null -> Icon(icon, contentDescription = null, tint = MaterialTheme.colorScheme.primary, modifier = Modifier.size(18.dp))
        color != null -> Box(modifier = Modifier.size(10.dp).background(color, CircleShape))
      }
      Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(2.dp)) {
        Text(label, maxLines = 1, overflow = TextOverflow.Ellipsis, color = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface)
        detail?.let { Text(it, color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelSmall) }
      }
      if (selected) Text("当前", style = MaterialTheme.typography.labelSmall, color = MaterialTheme.colorScheme.primary)
    }
  }
}

private fun parseCategoryColor(value: String): Color =
  runCatching { Color(value.toColorInt()) }.getOrDefault(Color.Unspecified)
