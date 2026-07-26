package com.idickies.storing.library

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class LibrarySortTest {
  @Test
  fun `each library view starts with the server aligned chronological sort`() {
    assertEquals(LibrarySort.Collected, LibrarySort.defaultFor(LibraryView.Inbox))
    assertEquals(LibrarySort.Favorited, LibrarySort.defaultFor(LibraryView.Favorites))
    assertEquals(LibrarySort.Archived, LibrarySort.defaultFor(LibraryView.Archive))
    assertEquals(LibrarySort.Published, LibrarySort.defaultFor(LibraryView.Published))
  }

  @Test
  fun `library opens on the personal inbox by default`() {
    assertEquals(LibraryView.Inbox, LibraryUiState().view)
  }

  @Test
  fun `view specific sort options never expose unsupported server sort values`() {
    assertTrue(LibrarySort.availableFor(LibraryView.Inbox).contains(LibrarySort.Collected))
    assertFalse(LibrarySort.availableFor(LibraryView.Inbox).contains(LibrarySort.Favorited))
    assertTrue(LibrarySort.availableFor(LibraryView.Favorites).contains(LibrarySort.Favorited))
    assertTrue(LibrarySort.availableFor(LibraryView.Archive).contains(LibrarySort.Archived))
  }
}

class LibrarySortMenuPresentationTest {
  @Test
  fun `sort menu presents descending first and ascending second`() {
    assertEquals(
      listOf(
        LibrarySortOrderOption(value = "desc", label = "降序 最新在前"),
        LibrarySortOrderOption(value = "asc", label = "升序 最早在前"),
      ),
      librarySortOrderOptions,
    )
  }
}
