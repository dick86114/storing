package com.idickies.storing.admin

import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

interface AdminApi {
  @GET("admin/users")
  suspend fun users(): AdminUsersResponse

  @POST("admin/users")
  suspend fun createUser(@Body request: AdminCreateUserRequest): AdminUserResponse

  @PATCH("admin/users/{id}")
  suspend fun updateUser(@Path("id") id: Int, @Body request: AdminUpdateUserRequest): AdminUserResponse

  @DELETE("admin/users/{id}")
  suspend fun deleteUser(@Path("id") id: Int, @Body request: AdminDeleteUserRequest): AdminDeleteUserResponse

  @GET("admin/audit-logs")
  suspend fun auditLogs(
    @Query("limit") limit: Int = 50,
    @Query("offset") offset: Int = 0,
    @Query("target_user_id") targetUserId: Int? = null,
  ): AdminAuditLogsResponse

  @GET("admin/mcp/default-limits")
  suspend fun mcpDefaultLimits(): AdminMcpPlatformLimits

  @PATCH("admin/mcp/default-limits")
  suspend fun updateMcpDefaultLimits(@Body request: AdminMcpUpdateLimitsRequest): AdminMcpPlatformLimits

  @GET("admin/mcp/clients")
  suspend fun mcpClients(): AdminMcpClientsResponse

  @GET("admin/mcp/request-logs")
  suspend fun mcpRequestLogs(
    @Query("limit") limit: Int = 50,
    @Query("offset") offset: Int = 0,
  ): AdminMcpRequestLogsResponse
}
