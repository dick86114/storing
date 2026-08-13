package com.idickies.storing.ui.components

import androidx.compose.ui.unit.dp
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ArticleCardLayoutTest {
  @Test
  fun `full article covers align to the outer card corners without a rectangular underlay`() {
    assertEquals(2.35f, articleCardLayout.coverAspectRatio)
    assertEquals(24.dp, articleCardLayout.cardCornerRadius)
    assertEquals(24.dp, articleCardLayout.coverCornerRadius)
    assertEquals(16.dp, articleCardLayout.contentPadding)
  }

  @Test
  fun `文章卡片在两种主题下都有可感知但克制的分层边界`() {
    assertTrue(articleCardSurfaceTokens(isDark = false).shadowElevation >= 12.dp)
    assertTrue(articleCardSurfaceTokens(isDark = false).borderAlpha >= 0.45f)
    assertTrue(articleCardSurfaceTokens(isDark = false).surfaceAlpha >= 0.96f)
    assertTrue(articleCardSurfaceTokens(isDark = true).shadowElevation > 0.dp)
    assertTrue(articleCardSurfaceTokens(isDark = true).borderAlpha > 0f)
  }
}
