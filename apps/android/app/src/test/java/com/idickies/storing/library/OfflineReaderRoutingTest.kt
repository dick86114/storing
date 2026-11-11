package com.idickies.storing.library

import com.idickies.storing.offline.OfflineArticle
import com.idickies.storing.offline.OfflineReaderContent
import com.idickies.storing.offline.offlineReaderDetail
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class OfflineReaderRoutingTest {
  @Test
  fun `offline reader keeps known library metadata while using the saved local body`() {
    val card = ArticleCard(
      id = 18,
      title = "在线标题",
      author = "作者",
      source = "来源",
      originalUrl = "https://example.com/article",
      aiSummary = "摘要",
      aiTags = listOf("Android"),
      isFavorited = true,
    )
    val offline = OfflineReaderContent(
      article = OfflineArticle(articleId = 18, title = "旧标题", source = "旧来源", author = null, localHtmlPath = "/tmp/content.html", localCoverPath = null),
      contentHtml = "<p>本地正文</p>",
    )

    val detail = offlineReaderDetail(card, offline)

    assertEquals("在线标题", detail.title)
    assertEquals("作者", detail.author)
    assertEquals("摘要", detail.aiSummary)
    assertEquals(listOf("Android"), detail.aiTags)
    assertEquals("<p>本地正文</p>", detail.contentHtml)
    assertTrue(detail.isFavorited)
  }

  @Test
  fun `offline list can open a saved body without the online library card`() {
    val offline = OfflineReaderContent(
      article = OfflineArticle(articleId = 23, title = "已下载文章", source = "微信公众号", author = "作者", localHtmlPath = "/tmp/content.html", localCoverPath = null),
      contentHtml = "<p>离线正文</p>",
    )

    val detail = offlineReaderDetail(card = null, offline = offline)

    assertEquals(23, detail.id)
    assertEquals("已下载文章", detail.title)
    assertEquals("微信公众号", detail.source)
    assertEquals("作者", detail.author)
    assertEquals("<p>离线正文</p>", detail.contentHtml)
  }

  @Test
  fun `automatic cache restores full detail while replacing the local body`() {
    val cachedDetail = ArticleDetail(
      id = 31,
      title = "缓存标题",
      source = "缓存来源",
      aiSummary = "缓存摘要",
      aiTags = listOf("缓存标签"),
      isFavorited = true,
      contentHtml = "不会使用这里的正文",
    )
    val cached = OfflineReaderContent(
      article = OfflineArticle(
        articleId = 31,
        userId = 1,
        title = "缓存标题",
        source = "缓存来源",
        author = null,
        localHtmlPath = "/tmp/content.html",
        localCoverPath = null,
        isPinned = false,
        hasCompleteAssets = false,
      ),
      contentHtml = "<p>本地缓存的正文</p>",
      detail = cachedDetail,
    )

    val detail = offlineReaderDetail(card = null, offline = cached)

    assertEquals("缓存摘要", detail.aiSummary)
    assertEquals(listOf("缓存标签"), detail.aiTags)
    assertTrue(detail.isFavorited)
    assertEquals("<p>本地缓存的正文</p>", detail.contentHtml)
  }
}
