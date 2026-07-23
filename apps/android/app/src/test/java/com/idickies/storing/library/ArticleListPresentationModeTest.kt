package com.idickies.storing.library

import org.junit.Assert.assertEquals
import org.junit.Test

class ArticleListPresentationModeTest {
  @Test
  fun `card remains the default while compact list is the dense alternative`() {
    assertEquals(ArticleListPresentationMode.Card, ArticleListPresentationMode.default)
    assertEquals("卡片", ArticleListPresentationMode.Card.label)
    assertEquals("列表", ArticleListPresentationMode.CompactList.label)
  }
}
