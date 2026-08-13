package com.idickies.storing.ui

import androidx.compose.ui.unit.dp
import com.idickies.storing.library.ArticleListPresentationMode
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class LibraryControlPresentationTest {
  @Test
  fun `library filter triggers share one compact height`() {
    assertEquals(40.dp, libraryControlMetrics.triggerHeight)
    assertEquals(36.dp, libraryControlMetrics.presentationCellSize)
  }

  @Test
  fun `归档分类与工具栏各占一行，批量整理不再单独占行`() {
    assertEquals(2, libraryArchiveControlMetrics.maxRows)
    assertEquals(40.dp, libraryArchiveControlMetrics.toolbarHeight)
    assertTrue(libraryArchiveControlMetrics.batchActionSharesToolbar)
  }

  @Test
  fun `library menus use compact bordered widths`() {
    assertEquals(216.dp, libraryMenuMetrics.moreMenuWidth)
    assertEquals(216.dp, libraryMenuMetrics.sortMenuWidth)
    assertEquals(280.dp, libraryMenuMetrics.sourceMenuWidth)
  }

  @Test
  fun `dark detail shimmer has more contrast than light detail shimmer`() {
    assertTrue(shimmerColors(isDark = true).baseAlpha > shimmerColors(isDark = false).baseAlpha)
    assertTrue(shimmerColors(isDark = true).highlightAlpha > shimmerColors(isDark = false).highlightAlpha)
    assertTrue(shimmerColors(isDark = true).usesDarkSurfaceBase)
  }

  @Test
  fun `dual column presentation uses the staggered masonry renderer`() {
    assertTrue(usesMasonryGrid(ArticleListPresentationMode.Grid))
    assertFalse(usesMasonryGrid(ArticleListPresentationMode.Card))
  }
}
