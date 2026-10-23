package com.idickies.storing.library

sealed interface CategoryAssignmentResult {
  val message: String
  val closesSheet: Boolean

  data class Success(
    val category: ArticleCategory,
    val succeededCount: Int,
  ) : CategoryAssignmentResult {
    override val message: String = "已分类到「${category.name}」"
    override val closesSheet: Boolean = true
  }

  data class Partial(
    val category: ArticleCategory,
    val succeededCount: Int,
    val skippedCount: Int,
    val failedCount: Int,
  ) : CategoryAssignmentResult {
    override val message: String =
      "已成功 $succeededCount 篇，跳过 $skippedCount 篇，失败 $failedCount 篇；请检查后重试。"
    override val closesSheet: Boolean = false
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
