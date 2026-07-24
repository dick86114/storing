package com.idickies.storing.mcp

import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

interface McpApi {
  @GET("mcp/me/limits")
  suspend fun limits(): McpPlatformLimits

  @GET("mcp/me/clients")
  suspend fun clients(): McpClientsResponse

  @POST("mcp/me/clients")
  suspend fun createClient(@Body request: McpCreateClientRequest): McpCreateClientResponse

  @PATCH("mcp/me/clients/{id}")
  suspend fun updateClient(@Path("id") id: Int, @Body request: McpUpdateClientRequest): McpClientResponse

  @POST("mcp/me/clients/{id}/rotate-key")
  suspend fun rotateKey(@Path("id") id: Int): McpRotateKeyResponse

  @DELETE("mcp/me/clients/{id}")
  suspend fun deleteClient(@Path("id") id: Int): McpDeleteClientResponse

  @GET("mcp/me/request-logs")
  suspend fun requestLogs(
    @Query("limit") limit: Int = 50,
    @Query("offset") offset: Int = 0,
  ): McpRequestLogsResponse
}
