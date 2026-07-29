package com.idickies.storing.reader

import com.idickies.storing.uilab.UiLabReaderFixture
import org.junit.Assert.assertTrue
import org.junit.Test

class ReaderDocumentTest {
  @Test
  fun `reader document preserves captured markup while injecting mobile viewport and constraint styles`() {
    val original = "<html><head><title>原文</title></head><body><table><tr><td>正文</td></tr></table><img src=\"https://example.com/a.jpg\"></body></html>"
    val document = ReaderDocument.forWebView(original)

    assertTrue(document.contains("<title>原文</title>"))
    assertTrue(document.contains("name=\"viewport\""))
    assertTrue(document.contains("max-width:none !important"))
    assertTrue(document.contains("overflow-x:auto"))
    assertTrue(document.contains("https://example.com/a.jpg"))
  }

  @Test
  fun `reader document keeps author colors intact while adding mobile text scaling and long content wrapping`() {
    val original = "<html><head></head><body style=\"color:#222;background:#fff\"><p>正文</p><blockquote>引用</blockquote></body></html>"
    val document = ReaderDocument.forWebView(original)

    assertTrue(document.contains("-webkit-text-size-adjust:100%"))
    assertTrue(document.contains("text-size-adjust:100%"))
    assertTrue(document.contains("blockquote, p, li { overflow-wrap:anywhere; }"))
    assertTrue(document.contains("style=\"color:#222;background:#fff\""))
  }

  @Test
  fun `debug reader fixture exercises the same constrained document with long content tables and images`() {
    val document = ReaderDocument.forWebView(UiLabReaderFixture.capturedHtml)

    assertTrue(document.contains("data-ui-lab-reader=\"true\""))
    assertTrue(document.contains("min-width:680px"))
    assertTrue(document.contains("table { display:block; width:max-content; max-width:none !important; overflow-x:auto"))
    assertTrue(document.contains("data:image/svg+xml"))
    assertTrue(document.contains("qiankunjie-mobile-reader"))
  }
}

class ReaderLightAppearanceTest {
  @Test
  fun `light reader uses a mint reading canvas and gives the title breathing room below navigation`() {
    val document = ReaderDocument.forWebView("<html><head></head><body><p>正文</p></body></html>")

    assertTrue(document.contains("background:#F2F8F3"))
    assertTrue(document.contains(".qj-header { padding:20px 0 0;"))
    assertTrue(document.contains("details.qj-ai-card { background:#F8FCF9"))
  }
}
