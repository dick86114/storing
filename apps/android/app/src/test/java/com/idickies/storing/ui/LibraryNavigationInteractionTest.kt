package com.idickies.storing.ui

import com.idickies.storing.library.LibraryView
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
  fun `horizontal swipes move one tab only after crossing the threshold`() {
    assertEquals(LibraryView.Favorites, adjacentLibraryView(LibraryView.Inbox, dragDistancePx = -120f))
    assertEquals(LibraryView.Inbox, adjacentLibraryView(LibraryView.Favorites, dragDistancePx = 120f))
    assertNull(adjacentLibraryView(LibraryView.Inbox, dragDistancePx = -40f))
  }
}
