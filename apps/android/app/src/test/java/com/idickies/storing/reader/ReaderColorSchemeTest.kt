package com.idickies.storing.reader

import org.junit.Assert.assertTrue
import org.junit.Test

class ReaderColorSchemeTest {
  @Test
  fun `dark reader document preserves structure and applies the book theme canvas`() {
    val document = ReaderDocument.forWebView(
      "<html><head></head><body><p style=\"color:#222;background:#fff\">正文</p></body></html>",
      ReaderColorScheme.Dark,
    )

    assertTrue(document.contains("padding:0 18px 32px"))
    assertTrue(document.contains("background:#071A12"))
    assertTrue(document.contains("color:#E8E4DC"))
    assertTrue(document.contains("color-scheme:dark"))
    assertTrue(document.contains("style=\"color:#222;background:#fff\""))
  }
}
