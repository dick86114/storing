package com.idickies.storing.library

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class LibraryPagingTest {
  @Test
  fun `more pages are available only while the current page is below total pages`() {
    assertTrue(LibraryPaging(page = 1, totalPages = 3).hasMore)
    assertTrue(LibraryPaging(page = 2, totalPages = 3).hasMore)
    assertFalse(LibraryPaging(page = 3, totalPages = 3).hasMore)
    assertFalse(LibraryPaging(page = 1, totalPages = 0).hasMore)
  }

  @Test
  fun `near-end scroll automatically requests the next page only when paging is available`() {
    assertTrue(shouldLoadMore(lastVisibleItemIndex = 17, itemCount = 20, hasMore = true))
    assertFalse(shouldLoadMore(lastVisibleItemIndex = 12, itemCount = 20, hasMore = true))
    assertFalse(shouldLoadMore(lastVisibleItemIndex = 19, itemCount = 20, hasMore = false))
  }

  @Test
  fun `next page appends new cards without duplicating an existing article`() {
    val current = listOf(ArticleCard(id = 1, title = "第一篇"), ArticleCard(id = 2, title = "第二篇"))
    val next = listOf(ArticleCard(id = 2, title = "重复"), ArticleCard(id = 3, title = "第三篇"))

    assertEquals(listOf(1, 2, 3), appendUniqueArticles(current, next).map { it.id })
  }
}
