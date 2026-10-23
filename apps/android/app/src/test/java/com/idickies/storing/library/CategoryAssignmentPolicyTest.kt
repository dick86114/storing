package com.idickies.storing.library

import com.idickies.storing.library.ArticleCategory
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class CategoryAssignmentPolicyTest {
  private val category = ArticleCategory(id = 8, name = "设计")

  @Test
  fun `完整成功明确报告分类名称`() {
    val result = CategoryAssignmentResult.Success(category, succeededIds = setOf(1, 2, 3))
    assertEquals("已分类到「设计」", result.message)
    assertTrue(result.closesSheet)
  }

  @Test
  fun `部分成功保留选择器并展示成功跳过失败数量`() {
    val result = CategoryAssignmentResult.Partial(
      category = category,
      succeededIds = setOf(1, 2),
      skippedIds = setOf(3),
      failedIds = setOf(4),
    )
    assertEquals("已成功 2 篇，跳过 1 篇，失败 1 篇；请重试失败项。", result.message)
    assertEquals(false, result.closesSheet)
  }

  @Test
  fun `成功且只有跳过项时进入可关闭终态`() {
    val result = CategoryAssignmentResult.CompletedWithSkipped(
      category = category,
      succeededIds = setOf(1, 2),
      skippedIds = setOf(3),
    )

    assertEquals("分类已完成，部分文章被跳过：成功 2 篇，跳过 1 篇。", result.message)
    assertTrue(result.closesSheet)
  }

  @Test
  fun `创建成功但分类失败使用独立文案`() {
    val result = CategoryAssignmentResult.CreatedButAssignmentFailed(category, "网络连接失败")
    assertEquals("分类「设计」已创建，但文章尚未分类，请重试。", result.message)
    assertEquals(false, result.closesSheet)
  }
}
