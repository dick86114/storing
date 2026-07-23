package com.idickies.storing.collect

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ManualCollectUrlTest {
  @Test
  fun `manual collection accepts a single trimmed http URL only`() {
    assertEquals("https://example.com/article", ManualCollectUrl.normalize("  https://example.com/article  "))
    assertEquals("http://example.com", ManualCollectUrl.normalize("http://example.com"))
    assertNull(ManualCollectUrl.normalize("file:///private/document"))
    assertNull(ManualCollectUrl.normalize("没有链接"))
  }
}
