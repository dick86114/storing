package com.idickies.storing.ui.components

import androidx.compose.ui.unit.dp
import org.junit.Assert.assertEquals
import org.junit.Test

class CompactBottomBarMetricsTest {
  @Test
  fun `compact bottom bar uses the approved 68 dp action target without additional vertical inset`() {
    assertEquals(68.dp, compactBottomBarMetrics.actionHeight)
    assertEquals(0.dp, compactBottomBarMetrics.verticalInset)
    assertEquals(68.dp, compactBottomBarMetrics.totalHeight)
  }
}
