package com.idickies.storing.library

import org.junit.Assert.assertEquals
import org.junit.Test

class ArticleListPresentationModeTest {
  @Test
  fun `library exposes compact list grid and full card presentations`() {
    assertEquals(ArticleListPresentationMode.Card, ArticleListPresentationMode.default)
    assertEquals("列表", ArticleListPresentationMode.CompactList.label)
    assertEquals("双列", ArticleListPresentationMode.Grid.label)
    assertEquals("卡片", ArticleListPresentationMode.Card.label)
  }
}
