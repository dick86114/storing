package com.idickies.storing.library

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ArticlePublicationTest {
  @Test
  fun `publication action toggles between public and private states`() {
    assertEquals(PublicationAction.Publish, publicationAction(isPublished = false))
    assertEquals(PublicationAction.Unpublish, publicationAction(isPublished = true))
  }

  @Test
  fun `public feed cards never expose private-library management actions`() {
    assertFalse(canManageArticle(isAuthenticated = false, view = LibraryView.Published))
    assertFalse(canManageArticle(isAuthenticated = true, view = LibraryView.Published))
    assertTrue(canManageArticle(isAuthenticated = true, view = LibraryView.Inbox))
  }
}
