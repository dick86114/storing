package com.idickies.storing.library

import com.idickies.storing.database.CachedArticleCard

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class CachedArticleCardTest {
  @Test
  fun `cached metadata preserves the card fields needed for offline library rendering`() {
    val cached = CachedArticleCard(userId = 1, view = "inbox", id = 9, title = "文章", source = "来源", aiSummary = "摘要", isFavorited = true)
    val card = cached.toArticleCard()
    assertEquals("文章", card.displayTitle)
    assertEquals("来源", card.source)
    assertEquals("摘要", card.aiSummary)
    assertTrue(card.isFavorited)
  }
}
