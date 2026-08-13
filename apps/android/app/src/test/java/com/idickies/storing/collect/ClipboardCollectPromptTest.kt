package com.idickies.storing.collect

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ClipboardCollectPromptTest {
  @Test
  fun `应用回到前台时会提示新的有效剪贴板链接`() {
    assertEquals(
      ClipboardCollectCandidate("https://example.com/article", timestamp = 100),
      clipboardUrlToPrompt(
        current = ClipboardCollectCandidate("https://example.com/article", timestamp = 100),
        pendingUrl = null,
        lastPrompted = null,
      ),
    )
  }

  @Test
  fun `同一份剪贴板链接不会在一次会话中重复提示`() {
    assertNull(
      clipboardUrlToPrompt(
        current = ClipboardCollectCandidate("https://example.com/article", timestamp = 100),
        pendingUrl = null,
        lastPrompted = ClipboardCollectCandidate("https://example.com/article", timestamp = 100),
      ),
    )
  }

  @Test
  fun `已经等待展示的链接不会被重复覆盖`() {
    assertNull(
      clipboardUrlToPrompt(
        current = ClipboardCollectCandidate("https://example.com/article", timestamp = 100),
        pendingUrl = "https://example.com/article",
        lastPrompted = null,
      ),
    )
  }

  @Test
  fun `重新复制相同链接时会因新的剪贴板时间戳再次提示`() {
    assertEquals(
      ClipboardCollectCandidate("https://example.com/article", timestamp = 200),
      clipboardUrlToPrompt(
        current = ClipboardCollectCandidate("https://example.com/article", timestamp = 200),
        pendingUrl = null,
        lastPrompted = ClipboardCollectCandidate("https://example.com/article", timestamp = 100),
      ),
    )
  }
}
