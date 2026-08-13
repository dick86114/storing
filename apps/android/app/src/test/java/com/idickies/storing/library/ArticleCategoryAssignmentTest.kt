package com.idickies.storing.library

import kotlinx.serialization.encodeToString
import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Test

class ArticleCategoryAssignmentTest {
  @Test
  fun `文章详情会解析待确认的 AI 分类理由`() {
    val detail = Json.decodeFromString<ArticleDetail>("""{"id":42,"categoryResult":{"categoryId":12,"source":"ai","confidence":0.62,"reason":"文章主要讨论数据库索引","reviewStatus":"needs_review","modelVersion":"model-1"}}""")

    assertEquals("needs_review", detail.categoryResult?.reviewStatus)
    assertEquals("文章主要讨论数据库索引", detail.categoryResult?.reason)
  }

  @Test
  fun `归档时可以携带用户选择的分类`() {
    val body = Json.encodeToString(ArticleArchiveRequest(categoryId = 12))

    assertEquals("{\"categoryId\":12}", body)
  }

  @Test
  fun `归档响应会保留已选分类以便立即更新阅读页`() {
    val result = Json.decodeFromString<ArchiveResponse>("""{"articleId":42,"isArchived":true,"category":{"id":12,"name":"技术"}}""")

    assertEquals("技术", result.category?.name)
  }

  @Test
  fun `重新判断分类响应保留文章标识`() {
    val result = Json.decodeFromString<ArticleClassifyResponse>("""{"articleId":42,"ok":true}""")

    assertEquals(42, result.articleId)
  }

  @Test
  fun `批量修改分类请求包含文章列表和目标分类`() {
    val body = Json.encodeToString(ArticleBulkCategoryRequest(articleIds = listOf(3, 8), categoryId = 12))

    assertEquals("{\"articleIds\":[3,8],\"categoryId\":12}", body)
  }

  @Test
  fun `批量重新判断分类请求只携带文章列表`() {
    val body = Json.encodeToString(ArticleBulkClassifyRequest(articleIds = listOf(3, 8)))

    assertEquals("{\"articleIds\":[3,8]}", body)
  }

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

  @Test
  fun `分类管理会保留分类规则与启用状态`() {
    val category = Json.decodeFromString<ArticleCategory>(
      """{"id":12,"name":"技术","description":"技术实践","includeExamples":["Docker"],"excludeExamples":["产品新闻"],"color":"#2F6A4F","sortOrder":3,"isActive":false,"isSystem":false}""",
    )

    assertEquals("技术实践", category.description)
    assertEquals(listOf("Docker"), category.includeExamples)
    assertEquals(false, category.isActive)
  }
}
