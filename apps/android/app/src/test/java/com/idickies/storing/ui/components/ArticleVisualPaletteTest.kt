package com.idickies.storing.ui.components

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Test

class ArticleVisualPaletteTest {
  @Test
  fun `fallback visual palettes are deterministic but vary across article ids`() {
    assertEquals(ArticleVisualPalettes.forArticle(12), ArticleVisualPalettes.forArticle(12))
    assertNotEquals(ArticleVisualPalettes.forArticle(12), ArticleVisualPalettes.forArticle(13))
  }
}
