package com.idickies.storing.ui.components

import androidx.compose.ui.unit.dp
import org.junit.Assert.assertEquals
import org.junit.Test

class ArticleCardLayoutTest {
  @Test
  fun `full article cards preserve the WeChat cover ratio and approved geometry`() {
    assertEquals(2.35f, articleCardLayout.coverAspectRatio)
    assertEquals(24.dp, articleCardLayout.cardCornerRadius)
    assertEquals(16.dp, articleCardLayout.coverCornerRadius)
    assertEquals(16.dp, articleCardLayout.contentPadding)
  }
}
