package com.idickies.storing.ui.components

import androidx.compose.ui.unit.dp
import org.junit.Assert.assertEquals
import org.junit.Test

class ReaderActionBarPresentationTest {
  @Test
  fun `reader action bar matches the library bottom bar action height`() {
    assertEquals(compactBottomBarMetrics.actionHeight, readerActionBarMetrics.actionHeight)
    assertEquals(68.dp, readerActionBarMetrics.actionHeight)
  }
}
