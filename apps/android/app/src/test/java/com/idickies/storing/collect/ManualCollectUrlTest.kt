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

  @Test
  fun `启动采集窗口时仅使用剪贴板中的有效网页链接`() {
    assertEquals(
      "https://example.com/article",
      ManualCollectUrl.fromClipboardText("  https://example.com/article  "),
    )
    assertEquals(
      "https://example.com/article",
      ManualCollectUrl.fromClipboardText("文章标题\nhttps://example.com/article\n来自浏览器"),
    )
    assertNull(ManualCollectUrl.fromClipboardText("复制了一段普通文字"))
  }

  @Test
  fun `仅在本次手动提交成功后关闭采集窗口`() {
    assertEquals(false, shouldDismissManualCollectDialog(submittedByThisDialog = false, submissionAccepted = true))
    assertEquals(false, shouldDismissManualCollectDialog(submittedByThisDialog = true, submissionAccepted = false))
    assertEquals(true, shouldDismissManualCollectDialog(submittedByThisDialog = true, submissionAccepted = true))
  }
}
