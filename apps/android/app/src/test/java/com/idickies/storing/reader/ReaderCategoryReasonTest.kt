package com.idickies.storing.reader

import com.idickies.storing.library.ArticleCategoryResult
import com.idickies.storing.library.ArticleDetail
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ReaderCategoryReasonTest {
  @Test
  fun `pending AI reason uses an inline icon control next to the category`() {
    val detail = ArticleDetail(
      id = 367,
      title = "测试",
      category = com.idickies.storing.library.ArticleCategory(id = 8, name = "服务器"),
      categoryResult = ArticleCategoryResult(
        categoryId = 8,
        confidence = 0.62,
        reason = "内容为部署自建同步服务端并配置反向代理。",
        source = "ai",
        reviewStatus = "needs_review",
        modelVersion = "model-1",
      ),
    )

    val header = ReaderDocument.buildArticleHeader(detail, ReaderColorScheme.Light, isOfflineAvailable = false)

    assertTrue(header.contains("qj-category-review-trigger"))
    assertTrue(header.contains("AI 分类依据"))
    assertTrue(header.contains("内容为部署自建同步服务端并配置反向代理。"))
    assertTrue(
      "categoryIndex=${header.indexOf("服务器")} triggerIndex=${header.indexOf("qj-category-review-trigger")} header=$header",
      header.indexOf("服务器") < header.indexOf("qj-category-review-trigger"),
    )
    assertFalse(header.contains("AI 分类待确认：内容为部署自建同步服务端并配置反向代理。"))

    val document = ReaderDocument.forWebView(
      capturedHtml = "",
      headerHtml = header,
    )
    assertTrue(document.contains("details.qj-category-review .qj-category-review-body"))
    assertTrue(document.contains("position:fixed"))
    assertTrue(document.contains("left:16px"))
    assertTrue(document.contains("right:16px"))
    assertTrue(document.contains("overflow-wrap:anywhere"))
  }

  @Test
  fun `confirmed AI reason does not render the inline icon control`() {
    val header = ReaderDocument.buildArticleHeader(
      article = ArticleDetail(
        id = 368,
        title = "测试",
        categoryResult = ArticleCategoryResult(
          categoryId = 8,
          confidence = 0.9,
          reason = "内容属于部署教程。",
          source = "ai",
          reviewStatus = "confirmed",
          modelVersion = "model-1",
        ),
      ),
      colorScheme = ReaderColorScheme.Light,
      isOfflineAvailable = false,
    )

    assertFalse(header.contains("qj-category-review-trigger"))
    assertFalse(header.contains("AI 分类依据"))
  }
}
