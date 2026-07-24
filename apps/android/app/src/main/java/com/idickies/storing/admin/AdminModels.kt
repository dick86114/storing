package com.idickies.storing.admin

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class AdminUser(
  val id: Int,
  val username: String,
  val role: String,
  val status: String,
  @SerialName("created_at") val createdAt: String? = null,
  @SerialName("updated_at") val updatedAt: String? = null,
  @SerialName("last_login_at") val lastLoginAt: String? = null,
  @SerialName("mcp_client_count") val mcpClientCount: Int = 0,
  @SerialName("active_mcp_client_count") val activeMcpClientCount: Int = 0,
  @SerialName("mcp_request_count") val mcpRequestCount: Int = 0,
  @SerialName("last_mcp_used_at") val lastMcpUsedAt: String? = null,
  @SerialName("inbox_count") val inboxCount: Int = 0,
  @SerialName("archive_count") val archiveCount: Int = 0,
  @SerialName("favorite_count") val favoriteCount: Int = 0,
)

@Serializable
data class AdminUsersResponse(val users: List<AdminUser> = emptyList())

@Serializable
data class AdminUserResponse(val user: AdminUser)

@Serializable
data class AdminCreateUserRequest(
  val username: String,
  val password: String,
  val role: String = "user",
  val status: String = "active",
)

@Serializable
data class AdminUpdateUserRequest(
  val username: String? = null,
  val role: String? = null,
  val status: String? = null,
  val password: String? = null,
)

@Serializable
data class AdminAuditLog(
  val id: Int,
  @SerialName("actor_user_id") val actorUserId: Int? = null,
  @SerialName("actor_username") val actorUsername: String? = null,
  @SerialName("target_user_id") val targetUserId: Int? = null,
  @SerialName("target_username") val targetUsername: String? = null,
  @SerialName("article_id") val articleId: Int? = null,
  @SerialName("article_title") val articleTitle: String? = null,
  val action: String,
  val detail: String? = null,
  @SerialName("created_at") val createdAt: String? = null,
)

@Serializable
data class AdminAuditLogsResponse(
  val total: Int = 0,
  val limit: Int = 50,
  val offset: Int = 0,
  val logs: List<AdminAuditLog> = emptyList(),
)

@Serializable
data class AdminMcpClient(
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
  @SerialName("last_used_at") val lastUsedAt: String? = null,
)

@Serializable
data class AdminMcpClientsResponse(val clients: List<AdminMcpClient> = emptyList())

@Serializable
data class AdminMcpPlatformLimits(
  @SerialName("rate_limit_per_minute") val rateLimitPerMinute: Int,
  @SerialName("rate_limit_per_day") val rateLimitPerDay: Int,
  @SerialName("concurrent_collect_limit") val concurrentCollectLimit: Int,
)

@Serializable
data class AdminMcpUpdateLimitsRequest(
  @SerialName("rate_limit_per_minute") val rateLimitPerMinute: Int,
  @SerialName("rate_limit_per_day") val rateLimitPerDay: Int,
  @SerialName("concurrent_collect_limit") val concurrentCollectLimit: Int,
)

@Serializable
data class AdminMcpRequestLog(
  val id: Int,
  @SerialName("client_id") val clientId: Int? = null,
  @SerialName("user_id") val userId: Int? = null,
  @SerialName("tool_name") val toolName: String,
  val url: String? = null,
  val status: String,
  @SerialName("error_code") val errorCode: String? = null,
  @SerialName("duration_ms") val durationMs: Int? = null,
  @SerialName("created_at") val createdAt: String? = null,
)

@Serializable
data class AdminMcpRequestLogsResponse(val logs: List<AdminMcpRequestLog> = emptyList())
