package com.idickies.storing.reader

import com.idickies.storing.library.ArticleDetail
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ReaderAiSummaryStatusTest {
  @Test
  fun `queued AI summary renders status even before summary text arrives`() {
    val header = ReaderDocument.buildArticleHeader(
      article = ArticleDetail(id = 1, aiStatus = "queued"),
      colorScheme = ReaderColorScheme.Light,
      isOfflineAvailable = false,
    )

    assertTrue(header.contains("qj-ai-status"))
    assertTrue(header.contains("排队中"))
    assertTrue(header.contains("正在准备摘要"))
  }

  @Test
  fun `failed AI summary shows diagnostic state model and usage`() {
    val header = ReaderDocument.buildArticleHeader(
      article = ArticleDetail(
        id = 2,
        aiStatus = "failed",
        aiErrorCode = "AI_UNAUTHORIZED",
        aiErrorMessage = "API Key 无效",
        aiModel = "deepseek-chat",
        aiTotalTokens = 321,
      ),
      colorScheme = ReaderColorScheme.Light,
      isOfflineAvailable = false,
    )

    assertTrue(header.contains("qj-ai-status-failed"))
    assertTrue(header.contains("生成失败"))
    assertTrue(header.contains("AI_UNAUTHORIZED：API Key 无效"))
    assertTrue(header.contains("模型：deepseek-chat"))
    assertTrue(header.contains("用量：321 tokens"))
  }

  @Test
  fun `successful AI summary does not render a redundant status badge`() {
    val header = ReaderDocument.buildArticleHeader(
      article = ArticleDetail(id = 3, aiSummary = "摘要内容", aiStatus = "succeeded"),
      colorScheme = ReaderColorScheme.Light,
      isOfflineAvailable = false,
    )

    assertTrue(header.contains("摘要内容"))
    assertFalse(header.contains("qj-ai-status"))
  }
}
