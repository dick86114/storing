package com.idickies.storing.admin

import kotlinx.serialization.decodeFromString
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class AdminUserDeletionModelTest {
  private val json = Json {
    ignoreUnknownKeys = true
    explicitNulls = false
  }

  @Test
  fun `删除用户响应会解码用户快照和清理统计`() {
    val result = json.decodeFromString<AdminDeleteUserResponse>(
      """{"deleted":true,"user_id":42,"username":"reader","cleanup":{"article_metadata":12,"collect_jobs":3,"mobile_sessions":2,"mcp_clients":1,"mcp_request_logs_anonymized":9,"admin_audit_logs_anonymized":4}}""",
    )

    assertTrue(result.deleted)
    assertEquals(42, result.userId)
    assertEquals("reader", result.username)
    assertEquals(12, result.cleanup.articleMetadata)
    assertEquals(4, result.cleanup.adminAuditLogsAnonymized)
  }
}
