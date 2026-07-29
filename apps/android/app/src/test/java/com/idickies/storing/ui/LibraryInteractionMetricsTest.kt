package com.idickies.storing.ui

import androidx.compose.ui.unit.dp
import org.junit.Assert.assertEquals
import org.junit.Test

class LibraryInteractionMetricsTest {
  @Test
  fun `library interaction chrome stays compact and avoids extra offscreen list composition`() {
    assertEquals(42.dp, libraryInteractionMetrics.searchFieldHeight)
    assertEquals(180L, libraryInteractionMetrics.searchDebounceMillis)
    assertEquals(0, libraryInteractionMetrics.pagerBeyondViewportPageCount)
    assertEquals(0.dp, libraryInteractionMetrics.lightCardShadowElevation)
  }
}
