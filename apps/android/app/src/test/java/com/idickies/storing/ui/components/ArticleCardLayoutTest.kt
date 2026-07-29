package com.idickies.storing.ui.components

import androidx.compose.ui.unit.dp
import org.junit.Assert.assertEquals
import org.junit.Test

class ArticleCardLayoutTest {
  @Test
  fun `full article covers align to the outer card corners without a rectangular underlay`() {
    assertEquals(2.35f, articleCardLayout.coverAspectRatio)
    assertEquals(24.dp, articleCardLayout.cardCornerRadius)
    assertEquals(24.dp, articleCardLayout.coverCornerRadius)
    assertEquals(16.dp, articleCardLayout.contentPadding)
  }
}
