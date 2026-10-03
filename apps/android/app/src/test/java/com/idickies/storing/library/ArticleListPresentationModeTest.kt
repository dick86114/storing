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

  @Test
  fun `saved presentation mode is restored on next launch`() {
    assertEquals(ArticleListPresentationMode.CompactList, parseArticleListPresentationMode("CompactList"))
    assertEquals(ArticleListPresentationMode.Grid, parseArticleListPresentationMode("Grid"))
    assertEquals(ArticleListPresentationMode.Card, parseArticleListPresentationMode("Card"))
  }

  @Test
  fun `missing or unknown presentation mode falls back to default`() {
    assertEquals(ArticleListPresentationMode.default, parseArticleListPresentationMode(null))
    assertEquals(ArticleListPresentationMode.default, parseArticleListPresentationMode(""))
    assertEquals(ArticleListPresentationMode.default, parseArticleListPresentationMode("已废弃的布局"))
  }
}
