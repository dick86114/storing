package com.idickies.storing.offline

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class OfflineAssetUrlTest {
  @Test
  fun `offline assets are exposed through an isolated https reader origin`() {
    val url = offlineAssetUrl(articleId = 42, fileName = "img_abc.jpg")

    assertEquals("https://offline.storing.local/articles/42/images/img_abc.jpg", url)
    assertEquals(OfflineAssetRequest(articleId = 42, fileName = "img_abc.jpg"), parseOfflineAssetRequest(url))
    assertTrue(offlineDocumentBaseUrl(42).startsWith("https://offline.storing.local/"))
  }

  @Test
  fun `offline asset parsing rejects other origins and path traversal`() {
    assertNull(parseOfflineAssetRequest("https://storing.idickies.com/articles/42/images/img.jpg"))
    assertNull(parseOfflineAssetRequest("https://offline.storing.local/articles/42/images/../secret.txt"))
    assertNull(parseOfflineAssetRequest("https://offline.storing.local/articles/nope/images/img.jpg"))
  }
}
