package com.idickies.storing.library

enum class LibrarySort(
  val apiValue: String,
  val label: String,
) {
  Collected("collected", "最近采集"),
  Favorited("favorited", "最近收藏"),
  Archived("archived", "最近归档"),
  Published("published", "最近发布");

  companion object {
    fun defaultFor(view: LibraryView): LibrarySort = when (view) {
      LibraryView.Inbox -> Collected
      LibraryView.Favorites -> Favorited
      LibraryView.Archive -> Archived
      LibraryView.Published -> Published
    }

    fun availableFor(view: LibraryView): List<LibrarySort> = when (view) {
      LibraryView.Inbox -> listOf(Collected, Published)
      LibraryView.Favorites -> listOf(Favorited, Collected, Published)
      LibraryView.Archive -> listOf(Archived, Collected, Published)
      LibraryView.Published -> listOf(Published)
    }
  }
}

data class LibrarySortOrderOption(
  val value: String,
  val label: String,
)

val librarySortOrderOptions = listOf(
  LibrarySortOrderOption(value = "desc", label = "降序 最新在前"),
  LibrarySortOrderOption(value = "asc", label = "升序 最早在前"),
)
