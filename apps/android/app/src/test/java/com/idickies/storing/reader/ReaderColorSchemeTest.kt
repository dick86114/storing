package com.idickies.storing.reader

import org.junit.Assert.assertTrue
import org.junit.Test

class ReaderColorSchemeTest {
  @Test
  fun `dark reader document preserves structure but applies Nord text gutters and dark canvas`() {
    val document = ReaderDocument.forWebView(
      "<html><head></head><body><p style=\"color:#222;background:#fff\">正文</p></body></html>",
      ReaderColorScheme.Dark,
    )

    assertTrue(document.contains("padding:0 18px 32px"))
    assertTrue(document.contains("background:#2E3440"))
    assertTrue(document.contains("color:#ECEFF4"))
    assertTrue(document.contains("color-scheme:dark"))
    assertTrue(document.contains("style=\"color:#222;background:#fff\""))
  }
}
