package com.idickies.storing.library

import org.junit.Assert.assertEquals
import org.junit.Test

class BulkExportFileNameTest {
  @Test
  fun `下载文件名包含任务ID且不含路径分隔符`() {
    val job = ArticleBulkExportJob(
      id = 42,
      format = "zip",
      status = ArticleBulkExportStatus.Succeeded,
      requestedCount = 2,
      downloadUrl = "/api/v1/articles/bulk-export/42/download",
      createdAt = "2026-10-10T00:00:00Z",
    )

    assertEquals("storing-bulk-export-42.zip", bulkExportFileName(job))
  }
}
