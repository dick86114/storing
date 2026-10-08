package com.idickies.storing.ai

import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Test

class AiSettingsModelsTest {
  private val json = Json { ignoreUnknownKeys = true }

  @Test
  fun `服务端用户 AI 配置解码且不包含明文 Key`() {
    val settings = json.decodeFromString<UserAiSettings>(
      """
      {
        "provider":"deepseek",
        "model":"deepseek-chat",
        "baseUrl":null,
        "apiKeyConfigured":true,
        "apiKeyLast4":"7890",
        "apiKeyUpdatedAt":"2026-10-08T08:00:00.000Z",
        "autoTriggerOnArchive":false,
        "updatedAt":"2026-10-08T08:00:00.000Z"
      }
      """.trimIndent(),
    )
    val rawJson = """
      {"provider":"deepseek","model":"deepseek-chat","apiKeyConfigured":true,"apiKeyLast4":"7890","autoTriggerOnArchive":false,"updatedAt":"2026-10-08T08:00:00.000Z"}
    """.trimIndent()

    assertEquals("deepseek", settings.provider)
    assertEquals("deepseek-chat", settings.model)
    assertEquals(true, settings.apiKeyConfigured)
    assertEquals("7890", settings.apiKeyLast4)
    assertFalse(settings.autoTriggerOnArchive)
    assertFalse(rawJson.contains("\"apiKey\""))
    assertFalse(rawJson.contains("apiKeyCiphertext"))
  }

  @Test
  fun `模型名可空且 AI 任务状态可解码`() {
    val response = json.decodeFromString<AiJobsResponse>(
      """
      {
        "jobs":[
          {
            "id":8,
            "articleId":3,
            "status":"failed",
            "errorCode":"AI_RATE_LIMITED",
            "errorMessage":"模型服务限流",
            "model":null,
            "totalTokens":42,
            "createdAt":"2026-10-08T08:00:00.000Z",
            "finishedAt":null
          }
        ],
        "total":1,
        "usage":{"totalJobs":1,"succeededJobs":0,"failedJobs":1,"totalTokens":42}
      }
      """.trimIndent(),
    )

    assertEquals(8, response.jobs.first().id)
    assertNull(response.jobs.first().model)
    assertEquals(42, response.usage.totalTokens)
    assertEquals("AI 失败", aiStatusText(response.jobs.first().status))
  }
}
