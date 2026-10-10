package com.idickies.storing.library

import org.junit.Assert.assertEquals
import org.junit.Test

class NativeBulkResultTest {
  @Test
  fun `普通动作归一部分结果`() {
    val result = NativeBulkResult.from(
      ArticleBulkActionResult(
        requestedCount = 3,
        succeededIds = listOf(1),
        skipped = listOf(ArticleBulkIssue(2, "ALREADY_FAVORITED")),
        failed = listOf(ArticleBulkIssue(3, "SERVER_ERROR", "失败")),
        publications = listOf(ArticlePublicationLink(1, "/p/a")),
      ),
    )

    assertEquals(3, result.requestedCount)
    assertEquals(1, result.succeededCount)
    assertEquals(1, result.skippedCount)
    assertEquals(2, result.issues.size)
    assertEquals("/p/a", result.publications.single().publicUrl)
  }

  @Test
  fun `AI结果把排队计入成功`() {
    val result = NativeBulkResult.from(
      ArticleBulkAiResult(
        requestedCount = 3,
        queuedIds = listOf(1),
        alreadyQueuedIds = listOf(2),
        failed = listOf(ArticleBulkIssue(3, "AI_NOT_CONFIGURED")),
      ),
    )

    assertEquals(1, result.succeededCount)
    assertEquals(1, result.skippedCount)
    assertEquals(1, result.issues.size)
  }

  @Test
  fun `删除成功项从选择集移除`() {
    assertEquals(setOf(2), removeBulkSelection(setOf(1, 2, 3), listOf(1, 3)))
  }

  @Test
  fun `刷新时清理失效选择`() {
    assertEquals(setOf(2), removeMissingBulkSelection(setOf(1, 2, 3), listOf(2, 4)))
  }
}
