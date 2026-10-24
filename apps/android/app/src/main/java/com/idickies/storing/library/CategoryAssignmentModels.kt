package com.idickies.storing.library

sealed interface CategoryAssignmentResult {
  val message: String
  val closesSheet: Boolean

  data class Success(
    val category: ArticleCategory,
    val succeededIds: Set<Int>,
  ) : CategoryAssignmentResult {
    val succeededCount: Int get() = succeededIds.size
    override val message: String = "已分类到「${category.name}」"
    override val closesSheet: Boolean = true
  }

  data class Partial(
    val category: ArticleCategory,
    val succeededIds: Set<Int>,
    val skippedIds: Set<Int>,
    val failedIds: Set<Int>,
  ) : CategoryAssignmentResult {
    val succeededCount: Int get() = succeededIds.size
    val skippedCount: Int get() = skippedIds.size
    val failedCount: Int get() = failedIds.size
    override val message: String =
      "已成功 $succeededCount 篇，跳过 $skippedCount 篇，失败 $failedCount 篇；请重试失败项。"
    override val closesSheet: Boolean = false
  }

  data class CompletedWithSkipped(
    val category: ArticleCategory,
    val succeededIds: Set<Int>,
    val skippedIds: Set<Int>,
  ) : CategoryAssignmentResult {
    val succeededCount: Int get() = succeededIds.size
    val skippedCount: Int get() = skippedIds.size
    override val message: String =
      "分类已完成，部分文章被跳过：成功 $succeededCount 篇，跳过 $skippedCount 篇。"
    override val closesSheet: Boolean = true
  }

  data class CreatedButAssignmentFailed(
    val category: ArticleCategory,
    val reason: String,
  ) : CategoryAssignmentResult {
    override val message: String = "分类「${category.name}」已创建，但文章尚未分类，请重试。"
    override val closesSheet: Boolean = false
  }

  data class Failure(override val message: String) : CategoryAssignmentResult {
    override val closesSheet: Boolean = false
  }
}

/** 成功与跳过都是终态，只有失败项保留在批量选择集中用于重试。 */
internal fun remainingCategoryAssignmentIds(
  selectedIds: Set<Int>,
  result: CategoryAssignmentResult,
): Set<Int> = when (result) {
  is CategoryAssignmentResult.Success -> selectedIds - result.succeededIds
  is CategoryAssignmentResult.Partial -> selectedIds - result.succeededIds - result.skippedIds
  is CategoryAssignmentResult.CompletedWithSkipped -> selectedIds - result.succeededIds - result.skippedIds
  else -> selectedIds
}

/** 将服务端批量响应归一化为选择器终态；只有存在失败 ID 时才允许重试。 */
internal fun categoryAssignmentBatchResult(
  category: ArticleCategory,
  requestedIds: Set<Int>,
  response: ArticleBulkActionResult,
): CategoryAssignmentResult {
  val succeededIds = response.succeededIds.filter(requestedIds::contains).toSet()
  val skippedIds = response.skipped.map { it.articleId }.filter(requestedIds::contains).toSet()
  val failedIds = (
    response.failed.map { it.articleId }.filter(requestedIds::contains).toSet() +
      (requestedIds - succeededIds - skippedIds)
    ).filterNot { it in succeededIds || it in skippedIds }.toSet()
  return when {
    failedIds.isNotEmpty() -> CategoryAssignmentResult.Partial(category, succeededIds, skippedIds, failedIds)
    skippedIds.isNotEmpty() -> CategoryAssignmentResult.CompletedWithSkipped(category, succeededIds, skippedIds)
    succeededIds.isNotEmpty() -> CategoryAssignmentResult.Success(category, succeededIds)
    else -> CategoryAssignmentResult.Failure("文章尚未分类，请重试")
  }
}
