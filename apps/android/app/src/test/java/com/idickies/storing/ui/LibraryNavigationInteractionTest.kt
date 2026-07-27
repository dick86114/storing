package com.idickies.storing.ui

import com.idickies.storing.library.LibraryView
import com.idickies.storing.library.mergeRefreshedFirstPage
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class LibraryNavigationInteractionTest {
  @Test
  fun `double tapping the active tab refreshes while a single tap scrolls to its beginning`() {
    assertEquals(LibraryTabInteraction.ScrollToStart, libraryTabInteraction(LibraryView.Inbox, LibraryView.Inbox, isDoubleTap = false))
    assertEquals(LibraryTabInteraction.Refresh, libraryTabInteraction(LibraryView.Inbox, LibraryView.Inbox, isDoubleTap = true))
    assertEquals(LibraryTabInteraction.Select, libraryTabInteraction(LibraryView.Inbox, LibraryView.Archive, isDoubleTap = false))
  }

  @Test
  fun `list refresh restores the original item and pixel offset when the refreshed list still contains it`() {
    val anchor = LibraryRefreshAnchor(itemIndex = 13, itemOffset = 42)

    assertEquals(anchor, restoreLibraryRefreshAnchor(anchor, itemCount = 20))
    assertEquals(LibraryRefreshAnchor(itemIndex = 4, itemOffset = 0), restoreLibraryRefreshAnchor(anchor, itemCount = 5))
  }

  @Test
  fun `refresh replaces the leading page but retains enough loaded content to preserve the current scroll range`() {
    assertEquals(
      listOf(101, 102, 1, 2, 3, 4),
      mergeRefreshedFirstPage(
        incoming = listOf(101, 102, 1, 2),
        current = listOf(1, 2, 3, 4, 5, 6),
        idOf = { it },
      ),
    )
  }

  @Test
  fun `horizontal swipes move one tab only after crossing the threshold`() {
    assertEquals(LibraryView.Favorites, adjacentLibraryView(LibraryView.Inbox, dragDistancePx = -120f))
    assertEquals(LibraryView.Inbox, adjacentLibraryView(LibraryView.Favorites, dragDistancePx = 120f))
    assertNull(adjacentLibraryView(LibraryView.Inbox, dragDistancePx = -40f))
  }
}
