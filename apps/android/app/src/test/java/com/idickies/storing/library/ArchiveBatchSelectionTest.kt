package com.idickies.storing.library

import org.junit.Assert.assertEquals
import org.junit.Test

class ArchiveBatchSelectionTest {
  @Test
  fun `选择同一篇文章两次会取消选择`() {
    assertEquals(emptySet<Int>(), toggleArchiveBatchSelection(setOf(12), 12))
  }

  @Test
  fun `选择文章会保留已有选择`() {
    assertEquals(setOf(3, 8), toggleArchiveBatchSelection(setOf(3), 8))
  }
}
