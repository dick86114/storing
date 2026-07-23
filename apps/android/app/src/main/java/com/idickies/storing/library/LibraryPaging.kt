package com.idickies.storing.library

/** Pagination metadata kept separately from the article cards displayed by the library. */
data class LibraryPaging(
  val page: Int = 1,
  val totalPages: Int = 0,
) {
  val hasMore: Boolean get() = page < totalPages
}

/**
 * Keeps the order of the cards already on screen while protecting the Compose list key from
 * duplicates if a backend page overlaps with a prior response.
 */
fun appendUniqueArticles(current: List<ArticleCard>, next: List<ArticleCard>): List<ArticleCard> {
  if (current.isEmpty()) return next.distinctBy(ArticleCard::id)
  val knownIds = current.mapTo(mutableSetOf()) { it.id }
  return current + next.filter { knownIds.add(it.id) }
}


/** Trigger automatic pagination when the user scrolls into the final three visible slots. */
fun shouldLoadMore(lastVisibleItemIndex: Int, itemCount: Int, hasMore: Boolean): Boolean =
  hasMore && itemCount > 0 && lastVisibleItemIndex >= itemCount - 3
