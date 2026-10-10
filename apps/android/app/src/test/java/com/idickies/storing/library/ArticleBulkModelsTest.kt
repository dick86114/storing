package com.idickies.storing.library

import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ArticleBulkModelsTest {
  private val json = Json { encodeDefaults = true; ignoreUnknownKeys = true }

  @Test
  fun `批量动作请求序列化为服务端契约`() {
    val body = json.encodeToString(
      ArticleBulkActionRequest.serializer(),
      ArticleBulkActionRequest(BulkArticleAction.Favorite, listOf(1, 2)),
    )

    assertTrue(body.contains("\"action\":\"favorite\""))
    assertTrue(body.contains("\"articleIds\":[1,2]"))
  }

  @Test
  fun `部分成功响应解码为统一结果`() {
    val payload = """
      {
        "requestedCount": 2,
        "succeededIds": [1],
        "skipped": [{"articleId":2,"code":"ALREADY_FAVORITED"}],
        "failed": [],
        "publications": [{"articleId":1,"publicUrl":"/p/abc"}]
      }
    """.trimIndent()

    val result = json.decodeFromString(ArticleBulkActionResult.serializer(), payload)

    assertEquals(2, result.requestedCount)
    assertEquals(listOf(1), result.succeededIds)
    assertEquals("ALREADY_FAVORITED", result.skipped.single().code)
    assertEquals("/p/abc", result.publications.single().publicUrl)
  }

  @Test
  fun `导出任务状态可解码`() {
    val payload = """
      {
        "id": 9,
        "format": "zip",
        "status": "running",
        "requestedCount": 3,
        "succeededCount": 0,
        "failedCount": 0,
        "downloadUrl": null,
        "createdAt": "2026-10-10T00:00:00Z",
        "finishedAt": null,
        "expiresAt": "2026-10-11T00:00:00Z"
      }
    """.trimIndent()

    val job = json.decodeFromString(ArticleBulkExportJob.serializer(), payload)

    assertEquals(9, job.id)
    assertEquals(ArticleBulkExportStatus.Running, job.status)
  }
}
