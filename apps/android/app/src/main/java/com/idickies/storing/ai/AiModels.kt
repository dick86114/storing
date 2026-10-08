package com.idickies.storing.ai

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class ArticleAiStatus(
  @SerialName("aiStatus") val value: String,
  @SerialName("aiErrorCode") val errorCode: String? = null,
  @SerialName("aiErrorMessage") val errorMessage: String? = null,
  @SerialName("aiModel") val model: String? = null,
  @SerialName("aiTotalTokens") val totalTokens: Int? = null,
)

@Serializable
data class UserAiSettings(
  val provider: String,
  val model: String,
  val baseUrl: String? = null,
  @SerialName("apiKeyConfigured") val apiKeyConfigured: Boolean,
  @SerialName("apiKeyLast4") val apiKeyLast4: String? = null,
  @SerialName("apiKeyUpdatedAt") val apiKeyUpdatedAt: String? = null,
  @SerialName("autoTriggerOnArchive") val autoTriggerOnArchive: Boolean,
  val updatedAt: String,
)

@Serializable
data class UserAiSettingsResponse(val settings: UserAiSettings? = null)

@Serializable
data class SaveUserAiSettingsRequest(
  val provider: String,
  val model: String,
  val baseUrl: String? = null,
  val apiKey: String? = null,
  @SerialName("autoTriggerOnArchive") val autoTriggerOnArchive: Boolean,
)

@Serializable
data class AiSettingsDeleteResponse(val deleted: Boolean = true)

@Serializable
data class AiModelOption(val id: String, val name: String? = null)

@Serializable
data class DiscoverAiModelsRequest(
  val provider: String,
  val baseUrl: String? = null,
  val apiKey: String? = null,
)

@Serializable
data class DiscoverAiModelsResponse(
  val models: List<AiModelOption> = emptyList(),
  val cached: Boolean = false,
)

@Serializable
data class AiSettingsTestResponse(
  val ok: Boolean = true,
  @SerialName("latencyMs") val latencyMs: Int,
)

@Serializable
data class AiGenerationUsageSummary(
  @SerialName("totalJobs") val totalJobs: Int,
  @SerialName("succeededJobs") val succeededJobs: Int,
  @SerialName("failedJobs") val failedJobs: Int,
  @SerialName("totalTokens") val totalTokens: Int,
)

@Serializable
data class AiJobSummary(
  val id: Int,
  @SerialName("articleId") val articleId: Int,
  val status: String,
  val model: String? = null,
  @SerialName("totalTokens") val totalTokens: Int? = null,
  val createdAt: String,
)

@Serializable
data class AiJobsResponse(
  val jobs: List<AiJobSummary> = emptyList(),
  val total: Int = 0,
  val usage: AiGenerationUsageSummary,
)

@Serializable
data class AiJobRetryResponse(val ok: Boolean = true)

fun aiStatusText(status: String?): String = when (status) {
  "not_generated" -> "未生成"
  "disabled" -> "自动生成已关闭"
  "not_configured" -> "未配置模型"
  "queued" -> "AI 排队中"
  "running" -> "AI 生成中"
  "succeeded" -> "AI 已完成"
  "failed" -> "AI 失败"
  else -> "未生成"
}
