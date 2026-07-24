package com.idickies.storing.reader

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ReaderPreferencesTest {
  @Test
  fun `default reader preferences preserve the current comfortable reading baseline`() {
    assertEquals(100, ReaderPreferences.Default.textZoomPercent)
    assertEquals(1.8f, ReaderPreferences.Default.lineHeight)
    assertEquals(18, ReaderPreferences.Default.horizontalPaddingPx)
  }

  @Test
  fun `reader document injects the selected line spacing and page gutters`() {
    val document = ReaderDocument.forWebView(
      "<html><head></head><body><p>正文</p></body></html>",
      preferences = ReaderPreferences(textZoomPercent = 110, lineHeight = 2.0f, horizontalPaddingPx = 28),
    )

    assertTrue(document.contains("padding:0 28px 32px"))
    assertTrue(document.contains("line-height:2.0"))
  }
}
