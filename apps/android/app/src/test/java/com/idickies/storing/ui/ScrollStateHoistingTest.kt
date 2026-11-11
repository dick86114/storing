package com.idickies.storing.ui

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class ScrollStateHoistingTest {
  private fun read(path: String): String = File("src/main/java/com/idickies/storing/ui/$path").readText()

  @Test
  fun `library scroll state is created outside the page that article detail replaces`() {
    val source = read("LibraryScreen.kt")

    assertTrue(source.contains("val inboxListState = rememberLazyStaggeredGridState()"))
    assertTrue(source.contains("listState: LazyStaggeredGridState"))
    assertFalse(source.contains("val gridState = rememberLazyStaggeredGridState()"))
  }

  @Test
  fun `settings scroll state survives entering and leaving a child page`() {
    val library = read("LibraryScreen.kt")
    val settings = read("SettingsScreen.kt")

    assertTrue(library.contains("val settingsListState = rememberLazyListState()"))
    assertTrue(library.contains("listState = settingsListState"))
    assertTrue(settings.contains("listState: LazyListState = rememberLazyListState()"))
    assertTrue(settings.contains("state = listState"))
  }
}
