package com.idickies.storing.ui

import com.idickies.storing.library.LibraryView
import com.idickies.storing.network.ArticleCounts
import com.idickies.storing.ui.theme.ThemeMode
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class LibraryTopBarPresentationTest {
  @Test
  fun `library top bar puts collect search and more in the approved order`() {
    assertEquals(
      listOf(LibraryTopAction.Collect, LibraryTopAction.Search, LibraryTopAction.More),
      libraryTopBarPresentation.actions,
    )
  }

  @Test
  fun `top search presentation only shows the normal title while search is closed`() {
    assertFalse(libraryTopSearchPresentation(searchOpen = false).showsSearchField)
    assertTrue(libraryTopSearchPresentation(searchOpen = true).showsSearchField)
  }

  @Test
  fun `top bar subtitle shows the active view total outside search`() {
    val counts = ArticleCounts(inbox = 150, favorites = 12, archive = 34, published = 5)

    assertEquals(LibraryTopBarSubtitle("收件箱", 150), libraryTopBarSubtitle(LibraryView.Inbox, searchQuery = "", counts = counts))
    assertEquals(LibraryTopBarSubtitle("收藏", 12), libraryTopBarSubtitle(LibraryView.Favorites, searchQuery = "", counts = counts))
    assertEquals(LibraryTopBarSubtitle("归档", 34), libraryTopBarSubtitle(LibraryView.Archive, searchQuery = "", counts = counts))
    assertEquals(LibraryTopBarSubtitle("发布", 5), libraryTopBarSubtitle(LibraryView.Published, searchQuery = "", counts = counts))
  }

  @Test
  fun `top bar subtitle omits a zero record count`() {
    assertEquals(
      LibraryTopBarSubtitle("归档", null),
      libraryTopBarSubtitle(LibraryView.Archive, searchQuery = "", counts = ArticleCounts(archive = 0)),
    )
  }

  @Test
  fun `top bar subtitle hides the record count while showing search results`() {
    assertEquals(
      LibraryTopBarSubtitle("搜索结果", null),
      libraryTopBarSubtitle(LibraryView.Inbox, searchQuery = "compose", counts = ArticleCounts(inbox = 150)),
    )
  }

  @Test
  fun `more menu exposes each theme mode as an individual selectable entry`() {
    assertEquals(listOf(ThemeMode.System, ThemeMode.Dark, ThemeMode.Light), libraryTopBarPresentation.themeModes)
  }
}
