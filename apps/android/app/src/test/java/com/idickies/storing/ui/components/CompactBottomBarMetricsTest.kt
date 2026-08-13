package com.idickies.storing.ui.components

import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import org.junit.Assert.assertEquals
import org.junit.Test

class CompactBottomBarMetricsTest {
  @Test
  fun `compact bottom bar uses the approved 68 dp action target without additional vertical inset`() {
    assertEquals(68.dp, compactBottomBarMetrics.actionHeight)
    assertEquals(0.dp, compactBottomBarMetrics.verticalInset)
    assertEquals(68.dp, compactBottomBarMetrics.totalHeight)
    assertEquals(2.dp, compactBottomBarMetrics.itemVerticalSpacing)
    assertEquals(30.dp, compactBottomBarMetrics.cornerRadius)
    assertEquals(12.dp, compactBottomBarMetrics.contentVerticalOffset)
  }
}

class CompactBottomBarDarkBaselineTest {
  @Test
  fun `dark navigation keeps the shared refined vertical rhythm and shadow`() {
    val metrics = compactBottomBarItemMetrics(isDark = true)

    assertEquals(2.dp, metrics.itemVerticalSpacing)
    assertEquals(12.dp, metrics.contentVerticalOffset)
    assertEquals(14.dp, metrics.shadowElevation)
  }
}

class CompactBottomBarSelectionStyleTest {
  @Test
  fun `浅色和深色主题都不使用选中项胶囊容器`() {
    assertEquals(false, compactBottomBarItemMetrics(isDark = false).showsSelectionContainer)
    assertEquals(false, compactBottomBarItemMetrics(isDark = true).showsSelectionContainer)
  }
}

class CompactBottomBarBadgeMetricsTest {
  @Test
  fun `数字气泡使用无字体内边距的固定行高以保持数字垂直居中`() {
    assertEquals(18.dp, compactBottomBarBadgeMetrics.size)
    assertEquals(10.sp, compactBottomBarBadgeMetrics.fontSize)
    assertEquals(10.sp, compactBottomBarBadgeMetrics.lineHeight)
    assertEquals(false, compactBottomBarBadgeMetrics.includeFontPadding)
  }
}
