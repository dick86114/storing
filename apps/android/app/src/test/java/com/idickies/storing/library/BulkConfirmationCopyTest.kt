package com.idickies.storing.library

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class BulkConfirmationCopyTest {
  @Test
  fun `所有批量动作都有中文确认文案`() {
    BulkToolbarAction.entries.forEach { action ->
      val copy = bulkActionConfirmation(action, selectedCount = 3)
      assertTrue(copy.title.isNotBlank())
      assertTrue(copy.message.contains("3"))
      assertEquals(
        action == BulkToolbarAction.Delete || action == BulkToolbarAction.PermanentDelete,
        copy.isDanger,
      )
    }
    assertEquals("确认批量删除？", bulkActionConfirmation(BulkToolbarAction.Delete, 3).title)
    assertEquals("确认批量彻底删除？", bulkActionConfirmation(BulkToolbarAction.PermanentDelete, 3).title)
    assertFalse(bulkActionConfirmation(BulkToolbarAction.ExportZip, 3).isDanger)
  }
}
