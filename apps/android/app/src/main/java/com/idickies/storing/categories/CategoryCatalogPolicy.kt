package com.idickies.storing.categories

import com.idickies.storing.library.ArticleCategory

internal const val MAX_CATEGORY_NAME_LENGTH = 40
internal const val MAX_RECENT_CATEGORIES = 5

internal val categoryDefaultColors = listOf(
  "#2F6A4F", "#3E7C83", "#536CCB", "#8A5A9E", "#B36A45", "#A67C38",
  "#647B4D", "#2F7780", "#6675B7", "#A16078", "#9B7250", "#6B7088",
)

sealed interface CategorySearchAction {
  data class UseExisting(val category: ArticleCategory) : CategorySearchAction
  data class Create(val name: String) : CategorySearchAction
  data object None : CategorySearchAction
}

/** 选择器只消费启用分类；系统分类始终排在用户分类之前。 */
internal fun activeCategories(categories: List<ArticleCategory>): List<ArticleCategory> =
  categories
    .filter(ArticleCategory::isActive)
    .sortedWith(compareByDescending<ArticleCategory> { it.isSystem }.thenBy { it.sortOrder }.thenBy { it.id })

internal fun searchCategories(categories: List<ArticleCategory>, query: String): List<ArticleCategory> {
  val needle = query.trim()
  if (needle.isEmpty()) return categories
  return categories.filter { it.name.contains(needle, ignoreCase = true) }
}

internal fun categorySearchAction(categories: List<ArticleCategory>, query: String): CategorySearchAction {
  val name = query.trim()
  if (name.isEmpty()) return CategorySearchAction.None
  val existing = categories.firstOrNull { it.name.trim().equals(name, ignoreCase = true) }
  return if (existing != null) CategorySearchAction.UseExisting(existing) else CategorySearchAction.Create(name)
}

internal fun isValidCategoryName(name: String): Boolean =
  name.trim().let { it.isNotEmpty() && it.length <= MAX_CATEGORY_NAME_LENGTH }

/** 名称不变时颜色不变，避免同一次轻量创建在重试时跳色。 */
internal fun stableCategoryColor(name: String): String {
  val normalized = name.trim()
  if (normalized.isEmpty()) return categoryDefaultColors.first()
  val index = normalized.fold(0) { hash, char -> (hash * 31 + char.code) and Int.MAX_VALUE } % categoryDefaultColors.size
  return categoryDefaultColors[index]
}

internal fun sanitizeRecentCategoryIds(ids: List<Int>, categories: List<ArticleCategory>): List<Int> {
  val activeIds = activeCategories(categories).asSequence().map(ArticleCategory::id).toSet()
  return ids.asSequence()
    .filter(activeIds::contains)
    .distinct()
    .take(MAX_RECENT_CATEGORIES)
    .toList()
}

internal fun recordRecentCategoryId(ids: List<Int>, categoryId: Int): List<Int> =
  (listOf(categoryId) + ids.filterNot { it == categoryId })
    .distinct()
    .take(MAX_RECENT_CATEGORIES)

internal fun moveUserCategory(categories: List<ArticleCategory>, movingId: Int, targetId: Int): List<Int>? {
  val movingIndex = categories.indexOfFirst { it.id == movingId }
  val targetIndex = categories.indexOfFirst { it.id == targetId }
  if (movingIndex < 0 || targetIndex < 0) return null
  val moving = categories[movingIndex]
  val target = categories[targetIndex]
  if (moving.isSystem || target.isSystem) return null
  val reordered = categories.map(ArticleCategory::id).toMutableList()
  reordered.removeAt(movingIndex)
  reordered.add(targetIndex, movingId)
  return reordered
}

internal fun isCategoryNameConflictMessage(message: String): Boolean =
  message.contains("CATEGORY_NAME_CONFLICT") ||
    message.contains("已存在同名") ||
    message.contains("同名启用分类") ||
    message.contains("HTTP 400")

/** 晚到的目录响应只有在账号与请求代际都未变化时才能写入共享状态。 */
internal fun shouldApplyCategoryResponse(
  expectedUserId: Int,
  expectedGeneration: Long,
  currentUserId: Int,
  currentGeneration: Long,
): Boolean = expectedUserId == currentUserId && expectedGeneration == currentGeneration
