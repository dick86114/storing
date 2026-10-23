package com.idickies.storing.library

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertSame
import org.junit.Test

class CategoryBatchSelectionPolicyTest {
  private val category = ArticleCategory(id = 9, name = "设计")

  @Test
  fun `部分成功只保留失败项用于重试`() {
    val result = CategoryAssignmentResult.Partial(
      category = category,
      succeededIds = setOf(1, 2),
      skippedIds = setOf(3),
      failedIds = setOf(4, 5),
    )

    assertEquals(2, result.succeededCount)
    assertEquals(1, result.skippedCount)
    assertEquals(2, result.failedCount)
    assertEquals(setOf(4, 5), remainingCategoryAssignmentIds(setOf(1, 2, 3, 4, 5), result))
  }

  @Test
  fun `成功加跳过且无失败时选择集为空并进入终态`() {
    val result = categoryAssignmentBatchResult(
      category = category,
      requestedIds = setOf(1, 2, 3),
      response = ArticleBulkActionResult(
        requestedCount = 3,
        succeededIds = listOf(1, 2),
        skipped = listOf(ArticleBulkIssue(articleId = 3, code = "ALREADY_ARCHIVED")),
      ),
    )

    assertEquals(CategoryAssignmentResult.CompletedWithSkipped(category, setOf(1, 2), setOf(3)), result)
    assertEquals(emptySet<Int>(), remainingCategoryAssignmentIds(setOf(1, 2, 3), result))
    assertEquals(true, result.closesSheet)
  }

  @Test
  fun `存在失败项时才保留选择集并提示重试`() {
    val result = categoryAssignmentBatchResult(
      category = category,
      requestedIds = setOf(1, 2, 3),
      response = ArticleBulkActionResult(
        requestedCount = 3,
        succeededIds = listOf(1),
        skipped = listOf(ArticleBulkIssue(articleId = 2, code = "SKIPPED")),
        failed = listOf(ArticleBulkIssue(articleId = 3, code = "FAILED")),
      ),
    )

    assertEquals(setOf(3), remainingCategoryAssignmentIds(setOf(1, 2, 3), result))
    assertEquals(false, result.closesSheet)
    assertEquals("已成功 1 篇，跳过 1 篇，失败 1 篇；请重试失败项。", result.message)
  }

  @Test
  fun `全部分类和当前目标分类场景下成功项都会从选择集中移除`() {
    val allViewSelection = setOf(1, 2, 3)
    val currentCategorySelection = setOf(1, 2, 3)
    val result = CategoryAssignmentResult.Success(category, succeededIds = setOf(1, 2, 3))

    assertEquals(emptySet<Int>(), remainingCategoryAssignmentIds(allViewSelection, result))
    assertEquals(emptySet<Int>(), remainingCategoryAssignmentIds(currentCategorySelection, result))
  }

  @Test
  fun `请求失败时保留原选择集`() {
    val selected = setOf(1, 2, 3)
    val result = CategoryAssignmentResult.Failure("网络失败")

    assertEquals(selected, remainingCategoryAssignmentIds(selected, result))
  }

  @Test
  fun `失效或停用的归档分类会清空筛选和旧文章`() {
    val card = ArticleCard(id = 1, title = "旧分类文章", isArchived = true, category = category)
    val state = LibraryUiState(
      view = LibraryView.Archive,
      archiveCategoryId = category.id,
      articles = listOf(card),
      page = 2,
      totalPages = 3,
    )

    val inactive = reconcileArchiveCategorySelection(state, listOf(category.copy(isActive = false)))
    assertNull(inactive.archiveCategoryId)
    assertEquals(emptyList<ArticleCard>(), inactive.articles)
    assertEquals(1, inactive.page)

    val stillActive = reconcileArchiveCategorySelection(state, listOf(category))
    assertSame(state, stillActive)
  }
}
