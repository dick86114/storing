package com.idickies.storing.mcp

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class McpClient(
  val id: Int,
  val name: String,
  @SerialName("owner_user_id") val ownerUserId: Int,
  @SerialName("owner_username") val ownerUsername: String? = null,
  val scopes: List<String> = emptyList(),
  val enabled: Boolean = true,
  @SerialName("rate_limit_per_minute") val rateLimitPerMinute: Int? = null,
  @SerialName("rate_limit_per_day") val rateLimitPerDay: Int? = null,
  @SerialName("concurrent_collect_limit") val concurrentCollectLimit: Int? = null,
  @SerialName("default_save_to_inbox") val defaultSaveToInbox: Boolean = false,
  @SerialName("created_at") val createdAt: String? = null,
  @SerialName("updated_at") val updatedAt: String? = null,
  @SerialName("last_used_at") val lastUsedAt: String? = null,
)

@Serializable
data class McpPlatformLimits(
  @SerialName("rate_limit_per_minute") val rateLimitPerMinute: Int,
  @SerialName("rate_limit_per_day") val rateLimitPerDay: Int,
  @SerialName("concurrent_collect_limit") val concurrentCollectLimit: Int,
)

@Serializable
data class McpRequestLog(
  val id: Int,
  @SerialName("client_id") val clientId: Int? = null,
  @SerialName("tool_name") val toolName: String,
  val url: String? = null,
  @SerialName("normalized_url") val normalizedUrl: String? = null,
  val status: String,
  @SerialName("error_code") val errorCode: String? = null,
  @SerialName("duration_ms") val durationMs: Int? = null,
  val transport: String? = null,
  @SerialName("created_at") val createdAt: String? = null,
)

@Serializable
data class McpClientsResponse(val clients: List<McpClient> = emptyList())

@Serializable
data class McpClientResponse(val client: McpClient)

@Serializable
data class McpCreateClientRequest(
  val name: String,
  val scopes: List<String>,
  val enabled: Boolean = true,
  @SerialName("default_save_to_inbox") val defaultSaveToInbox: Boolean = false,
)

@Serializable
data class McpUpdateClientRequest(
  val enabled: Boolean? = null,
  val scopes: List<String>? = null,
  @SerialName("default_save_to_inbox") val defaultSaveToInbox: Boolean? = null,
)

@Serializable
data class McpCreateClientResponse(
  val client: McpClient,
  @SerialName("api_key") val apiKey: String,
)

@Serializable
data class McpRotateKeyResponse(
  val client: McpClient,
  @SerialName("api_key") val apiKey: String,
)

@Serializable
data class McpRequestLogsResponse(val logs: List<McpRequestLog> = emptyList())

@Serializable
data class McpDeleteClientResponse(val revoked: Boolean = true)

/** All available MCP scopes with display labels. */
enum class McpScope(val value: String, val label: String, val description: String) {
  SummaryCreate("summary:create", "生成摘要", "提交 URL 生成临时摘要"),
  CollectCreate("collect:create", "采集文章", "提交 URL 采集文章到资料库"),
  InboxWrite("inbox:write", "写入收件箱", "允许采集时保存到收件箱"),
  JobReadSelf("job:read:self", "查看任务", "查看自己的采集任务状态");

  companion object {
    fun fromValue(value: String): McpScope? = entries.firstOrNull { it.value == value }
  }
}
