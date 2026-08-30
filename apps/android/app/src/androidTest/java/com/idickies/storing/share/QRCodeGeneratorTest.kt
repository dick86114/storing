package com.idickies.storing.share

import android.graphics.Bitmap
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertTrue
import org.junit.Test

class QRCodeGeneratorTest {

  @Test
  fun generateProducesSquareBitmapWithCorrectSize() {
    val bitmap = QRCodeGenerator.generate("https://storing.idickies.cc/p/abc123", sizePx = 256)
    assertNotNull(bitmap)
    assertEquals(256, bitmap.width)
    assertEquals(256, bitmap.height)
  }

  @Test
  fun generateEncodesContentIntoNonTrivialPattern() {
    val bitmap = QRCodeGenerator.generate("https://storing.idickies.cc/p/test-article-id", sizePx = 128)
    var blackPixels = 0
    var whitePixels = 0
    val pixels = IntArray(bitmap.width * bitmap.height)
    bitmap.getPixels(pixels, 0, bitmap.width, 0, 0, bitmap.width, bitmap.height)
    for (p in pixels) {
      if (p == -0x1000000) blackPixels++
      else whitePixels++
    }
    assertTrue("Expected black pixels, got $blackPixels", blackPixels > 0)
    assertTrue("Expected white/transparent pixels, got $whitePixels", whitePixels > 0)
    assertTrue("QR should not be >95% black", blackPixels < pixels.size * 0.95)
  }
}
