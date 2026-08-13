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
}
