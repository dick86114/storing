package com.idickies.storing.ui.components

import org.junit.Assert.assertEquals
import org.junit.Test

class ArticleCardStatusMarkerTest {
  @Test
  fun `published cards expose a distinct publication marker alongside favorite state`() {
    assertEquals(
      listOf(ArticleCardStatusMarker.Favorite, ArticleCardStatusMarker.Published),
      articleCardStatusMarkers(isFavorited = true, isArchived = false, isPublished = true),
    )
  }

  @Test
  fun `published status is only represented once in article metadata`() {
    assertEquals(
      1,
      articleCardStatusMarkers(isFavorited = false, isArchived = false, isPublished = true)
        .count { it == ArticleCardStatusMarker.Published },
    )
  }
}
