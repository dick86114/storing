package com.idickies.storing.ui

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
  fun `more menu exposes each theme mode as an individual selectable entry`() {
    assertEquals(listOf(ThemeMode.System, ThemeMode.Dark, ThemeMode.Light), libraryTopBarPresentation.themeModes)
  }
}
