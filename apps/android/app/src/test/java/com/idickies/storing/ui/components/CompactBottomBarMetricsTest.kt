package com.idickies.storing.ui.components

import androidx.compose.ui.unit.dp
import org.junit.Assert.assertEquals
import org.junit.Test

class CompactBottomBarMetricsTest {
  @Test
  fun `compact bottom bar stays below the old material navigation height while retaining a 56 dp action target`() {
    assertEquals(56.dp, compactBottomBarMetrics.actionHeight)
    assertEquals(6.dp, compactBottomBarMetrics.verticalInset)
    assertEquals(68.dp, compactBottomBarMetrics.totalHeight)
  }
}
