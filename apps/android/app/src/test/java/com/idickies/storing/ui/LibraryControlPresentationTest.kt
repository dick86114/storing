package com.idickies.storing.ui

import androidx.compose.ui.unit.dp
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class LibraryControlPresentationTest {
  @Test
  fun `library filter triggers share one compact height`() {
    assertEquals(40.dp, libraryControlMetrics.triggerHeight)
    assertEquals(36.dp, libraryControlMetrics.presentationCellSize)
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
}
