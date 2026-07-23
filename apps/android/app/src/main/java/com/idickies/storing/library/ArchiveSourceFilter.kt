package com.idickies.storing.library

/**
 * A user-selected source constraint for the archive view.
 *
 * The API expects the exact source value in the optional `category` query parameter;
 * `null` intentionally omits the parameter and means all sources.
 */
data class ArchiveSourceFilter(
  val category: String?,
  val label: String,
) {
  companion object {
    val All = ArchiveSourceFilter(category = null, label = "全部来源")

    fun source(value: String): ArchiveSourceFilter = ArchiveSourceFilter(category = value, label = value)

    fun isAvailableFor(view: LibraryView, searchQuery: String): Boolean =
      view == LibraryView.Archive && searchQuery.isBlank()
  }
}


/** Builds a stable picker model from the user-scoped archive source summary. */
fun archiveSourceFilters(sources: List<ArticleSource>): List<ArchiveSourceFilter> =
  buildList {
    add(ArchiveSourceFilter.All)
    sources
      .asSequence()
      .map { it.source }
      .filter { it.isNotBlank() }
      .distinct()
      .forEach { add(ArchiveSourceFilter.source(it)) }
  }
