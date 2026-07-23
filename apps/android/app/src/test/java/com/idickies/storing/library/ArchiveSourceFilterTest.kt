package com.idickies.storing.library

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ArchiveSourceFilterTest {
  @Test
  fun `all sources uses no category query parameter`() {
    assertEquals("全部来源", ArchiveSourceFilter.All.label)
    assertNull(ArchiveSourceFilter.All.category)
  }

  @Test
  fun `specific source preserves the server category exactly`() {
    val filter = ArchiveSourceFilter.source("微信公众号")
    assertEquals("微信公众号", filter.label)
    assertEquals("微信公众号", filter.category)
  }

  @Test
  fun `source filter is available only in the non-search archive library`() {
    org.junit.Assert.assertTrue(ArchiveSourceFilter.isAvailableFor(LibraryView.Archive, ""))
    org.junit.Assert.assertFalse(ArchiveSourceFilter.isAvailableFor(LibraryView.Inbox, ""))
    org.junit.Assert.assertFalse(ArchiveSourceFilter.isAvailableFor(LibraryView.Favorites, ""))
    org.junit.Assert.assertFalse(ArchiveSourceFilter.isAvailableFor(LibraryView.Archive, "关键词"))
  }

  @Test
  fun `source picker keeps the all option first and ignores empty server values`() {
    val options = archiveSourceFilters(
      listOf(
        ArticleSource(source = "微信公众号", count = 12),
        ArticleSource(source = "", count = 3),
        ArticleSource(source = "少数派", count = 2),
      ),
    )

    assertEquals(listOf("全部来源", "微信公众号", "少数派"), options.map { it.label })
  }
}
