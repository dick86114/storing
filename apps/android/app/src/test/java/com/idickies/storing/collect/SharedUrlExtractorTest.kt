package com.idickies.storing.collect

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class SharedUrlExtractorTest {
  @Test
  fun `extracts normalized http URLs in order and ignores unsupported share content`() {
    assertEquals(
      listOf("https://example.com/article?a=1", "http://example.org/path"),
      SharedUrlExtractor.extract("标题 https://example.com/article?a=1，另一个 http://example.org/path。"),
    )
    assertTrue(SharedUrlExtractor.extract("file:///private/data").isEmpty())
    assertTrue(SharedUrlExtractor.extract("这是没有链接的纯文本").isEmpty())
  }
}
