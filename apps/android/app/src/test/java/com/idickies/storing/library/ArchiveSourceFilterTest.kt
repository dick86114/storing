package com.idickies.storing.library

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class ArchiveSourceFilterTest {
  @Test
  fun `all sources uses no category query parameter`() {
    assertEquals("全部来源", ArchiveSourceFilter.All.label)
    assertTrue(ArchiveSourceFilter.All.categories.isEmpty())
    assertNull(ArchiveSourceFilter.All.category)
  }

  @Test
  fun `specific source preserves the server category exactly`() {
    val filter = ArchiveSourceFilter.source("微信公众号")
    assertEquals("微信公众号", filter.label)
    assertEquals(setOf("微信公众号"), filter.categories)
    assertEquals("微信公众号", filter.category)
  }

  @Test
  fun `multiple selected sources use a concise count label`() {
    val filter = ArchiveSourceFilter.of("微信公众号", "少数派")

    assertEquals(setOf("微信公众号", "少数派"), filter.categories)
    assertEquals("2 个来源", filter.label)
    assertNull(filter.category)
  }

  @Test
  fun `toggling a selected source removes only that source`() {
    val filter = ArchiveSourceFilter.of("微信公众号", "少数派")

    assertEquals(setOf("少数派"), filter.toggle("微信公众号").categories)
    assertEquals(ArchiveSourceFilter.All, ArchiveSourceFilter.source("少数派").toggle("少数派"))
  }

  @Test
  fun `source query values are omitted for all and stable for a selection`() {
    assertNull(archiveSourceQueryCategories(ArchiveSourceFilter.All))
    assertEquals(
      listOf("少数派", "微信公众号"),
      archiveSourceQueryCategories(ArchiveSourceFilter.of("微信公众号", "少数派")),
    )
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

  @Test
  fun `source search filters visible options without mutating selected sources`() {
    val options = listOf(
      ArticleSource(source = "微信公众号", count = 12),
      ArticleSource(source = "少数派", count = 2),
      ArticleSource(source = "爱范儿", count = 1),
    )
    val selected = ArchiveSourceFilter.of("微信公众号", "爱范儿")

    assertEquals(listOf("少数派"), filteredArchiveSourceOptions(options, "少数").map { it.source })
    assertEquals(setOf("微信公众号", "爱范儿"), selected.categories)
  }

  @Test
  fun `source filter is available only in the non-search archive library`() {
    assertTrue(ArchiveSourceFilter.isAvailableFor(LibraryView.Archive, ""))
    assertFalse(ArchiveSourceFilter.isAvailableFor(LibraryView.Inbox, ""))
    assertFalse(ArchiveSourceFilter.isAvailableFor(LibraryView.Favorites, ""))
    assertFalse(ArchiveSourceFilter.isAvailableFor(LibraryView.Archive, "关键词"))
  }
}
