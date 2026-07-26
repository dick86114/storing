package com.idickies.storing.admin

import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Test

class AdminAuditLogSerializationTest {
  @Test
  fun `audit log accepts object detail returned by the server`() {
    val response = Json.decodeFromString<AdminAuditLogsResponse>(
      """{"logs":[{"id":1,"action":"article_metadata_deleted","detail":{"source_type":"web"}}]}""",
    )

    assertEquals("{\"source_type\":\"web\"}", response.logs.single().detailText)
  }
}
