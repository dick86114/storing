package com.idickies.storing.library

import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Test

class ArticleCategoryAssignmentTest {
  @Test
  fun `修改文章分类请求使用服务端要求的 categoryId`() {
    val body = Json.encodeToString(ArticleCategoryAssignmentRequest(categoryId = 12))

    assertEquals("{\"categoryId\":12}", body)
  }

  @Test
  fun `修改文章分类响应保留文章和更新计数`() {
    val result = ArticleCategoryAssignmentResponse(articleId = 42, updatedCount = 1)

    assertEquals(42, result.articleId)
    assertEquals(1, result.updatedCount)
  }
}
