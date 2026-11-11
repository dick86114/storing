package com.idickies.storing.reader

import com.idickies.storing.library.ArticleDetail
import com.idickies.storing.library.ArticleCategory
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ReaderDocumentHeaderTest {
  @Test
  fun `reader header shows the archived article category`() {
    val html = ReaderDocument.buildArticleHeader(
      ArticleDetail(id = 1, title = "测试", category = ArticleCategory(id = 2, name = "技术")),
      ReaderColorScheme.Light,
      isOfflineAvailable = false,
    )

    assertTrue(html.contains("技术"))
  }

  @Test
  fun `detail header no longer renders a source badge above the title`() {
    val header = ReaderDocument.buildArticleHeader(
      article = ArticleDetail(id = 1, title = "测试", source = "微信公众号", originalUrl = "https://mp.weixin.qq.com/s/example"),
      colorScheme = ReaderColorScheme.Dark,
      isOfflineAvailable = false,
    )

    assertFalse(header.contains("qj-source-tag"))
  }

  @Test
  fun `detail header renders the article cover before the title`() {
    val header = ReaderDocument.buildArticleHeader(
      article = ArticleDetail(
        id = 2,
        title = "带封面文章",
        coverImage = "https://cdn.example.com/cover.jpg",
      ),
      colorScheme = ReaderColorScheme.Light,
      isOfflineAvailable = false,
    )

    assertTrue(header.contains("""<img class="qj-cover" src="https://cdn.example.com/cover.jpg"""))
    assertTrue(header.indexOf("qj-cover") < header.indexOf("qj-title"))
  }

  @Test
  fun `detail header distinguishes automatic cache from pinned offline save`() {
    val cachedHeader = ReaderDocument.buildArticleHeader(
      article = ArticleDetail(id = 3, title = "缓存文章"),
      colorScheme = ReaderColorScheme.Light,
      isOfflineAvailable = false,
      isReadingCached = true,
    )
    val savedHeader = ReaderDocument.buildArticleHeader(
      article = ArticleDetail(id = 4, title = "离线文章"),
      colorScheme = ReaderColorScheme.Light,
      isOfflineAvailable = true,
      isReadingCached = true,
    )

    assertTrue(cachedHeader.contains("本地缓存"))
    assertTrue(savedHeader.contains("离线已保存"))
  }
}
