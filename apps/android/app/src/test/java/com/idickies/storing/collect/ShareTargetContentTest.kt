package com.idickies.storing.collect

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ShareTargetContentTest {
  @Test
  fun `share target preselects the first valid URL and describes an empty share explicitly`() {
    val content = ShareTargetContent.from("标题 https://example.com/one 和 https://example.com/two")
    assertEquals(listOf("https://example.com/one", "https://example.com/two"), content.urls)
    assertEquals("https://example.com/one", content.selectedUrl)
    assertNull(content.message)

    val empty = ShareTargetContent.from("没有可采集链接")
    assertEquals(emptyList<String>(), empty.urls)
    assertNull(empty.selectedUrl)
    assertEquals("未识别到可采集的网页链接", empty.message)
  }
}
