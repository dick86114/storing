package com.idickies.storing.reader

import com.idickies.storing.library.ArticleDetail
import org.junit.Assert.assertFalse
import org.junit.Test

class ReaderDocumentHeaderTest {
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
