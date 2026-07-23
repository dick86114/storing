package com.idickies.storing.reader

import org.junit.Assert.assertTrue
import org.junit.Test

class ReaderDocumentTest {
  @Test
  fun `reader document preserves captured markup while injecting mobile viewport and constraint styles`() {
    val original = "<html><head><title>原文</title></head><body><table><tr><td>正文</td></tr></table><img src=\"https://example.com/a.jpg\"></body></html>"
    val document = ReaderDocument.forWebView(original)

    assertTrue(document.contains("<title>原文</title>"))
    assertTrue(document.contains("name=\"viewport\""))
    assertTrue(document.contains("max-width:100%"))
    assertTrue(document.contains("overflow-x:auto"))
    assertTrue(document.contains("https://example.com/a.jpg"))
  }
}
