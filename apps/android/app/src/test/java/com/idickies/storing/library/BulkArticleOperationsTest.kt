package com.idickies.storing.library

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertThrows
import org.junit.Test

class BulkArticleOperationsTest {
  @Test
  fun `批量动作按视图收敛`() {
    assertEquals(
      listOf(
        BulkToolbarAction.Favorite,
        BulkToolbarAction.Archive,
        BulkToolbarAction.Delete,
        BulkToolbarAction.PermanentDelete,
        BulkToolbarAction.GenerateAi,
        BulkToolbarAction.Publish,
        BulkToolbarAction.ExportZip,
      ),
      bulkToolbarActions(LibraryView.Inbox),
    )
    assertFalse(bulkToolbarActions(LibraryView.Inbox).contains(BulkToolbarAction.Unpublish))
  }

  @Test
  fun `Android不包含批量Obsidian动作`() {
    assertFalse(BulkToolbarAction.entries.any { it.name == "BulkObsidian" })
  }

  @Test
  fun `超过200篇或非法ID会被拒绝`() {
    assertThrows(IllegalArgumentException::class.java) {
      validatedBulkArticleIds((1..201).toList())
    }
    assertThrows(IllegalArgumentException::class.java) {
      validatedBulkArticleIds(listOf(1, 0, 2))
    }
  }
}
