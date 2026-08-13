package com.idickies.storing.library

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ArchiveTagFilterTest {
  @Test
  fun `tag filter keeps unique nonblank tags in stable order`() {
    val filter = ArchiveTagFilter.of("效率", "", "阅读", "效率")

    assertEquals(listOf("效率", "阅读"), filter.tags)
    assertEquals("2 个标签", filter.label)
  }

  @Test
  fun `all tags has no active tag query`() {
    assertTrue(ArchiveTagFilter.All.tags.isEmpty())
    assertFalse(ArchiveTagFilter.All.isActive)
    assertEquals("标签", ArchiveTagFilter.All.label)
  }
}
