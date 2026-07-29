package com.idickies.storing.library

/**
 * A user-selected source constraint for the archive view.
 *
 * Empty selections intentionally omit the optional `category` query parameter and mean all
 * sources. Multiple selected values are sent as repeated `category` query parameters and use
 * OR semantics on the server.
 */
data class ArchiveSourceFilter private constructor(
  val categories: Set<String>,
) {
  /** Retained for the single-source callers that have not yet migrated to [categories]. */
  val category: String? get() = categories.singleOrNull()

  val isAll: Boolean get() = categories.isEmpty()

  val label: String get() = when (categories.size) {
    0 -> "全部来源"
    1 -> categories.first()
    else -> "${categories.size} 个来源"
  }

  fun toggle(source: String): ArchiveSourceFilter {
    val normalized = normalize(source) ?: return this
    return if (normalized in categories) {
      ArchiveSourceFilter(categories - normalized)
    } else {
      ArchiveSourceFilter(categories + normalized)
    }
  }

  companion object {
    val All = ArchiveSourceFilter(emptySet())

    fun source(value: String): ArchiveSourceFilter = of(value)

    fun of(vararg values: String): ArchiveSourceFilter = ArchiveSourceFilter(
      values.mapNotNull(::normalize).toCollection(linkedSetOf()),
    )

    fun isAvailableFor(view: LibraryView, searchQuery: String): Boolean =
      view == LibraryView.Archive && searchQuery.isBlank()

    private fun normalize(value: String): String? = value.trim().takeIf { it.isNotEmpty() }
  }
}

/** Converts source selections into stable repeated Retrofit query values, or omits them for all. */
fun archiveSourceQueryCategories(filter: ArchiveSourceFilter): List<String>? =
  filter.categories.sorted().takeIf { it.isNotEmpty() }

/** Filters the visible source rows without modifying the source selection draft. */
fun filteredArchiveSourceOptions(options: List<ArticleSource>, query: String): List<ArticleSource> {
  val normalizedQuery = query.trim()
  if (normalizedQuery.isEmpty()) return options
  return options.filter { it.source.contains(normalizedQuery, ignoreCase = true) }
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
