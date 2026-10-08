package com.idickies.storing.network

import com.idickies.storing.ai.AiJobRetryResponse
import com.idickies.storing.ai.AiJobsResponse
import com.idickies.storing.ai.AiSettingsDeleteResponse
import com.idickies.storing.ai.AiSettingsTestResponse
import com.idickies.storing.ai.DiscoverAiModelsRequest
import com.idickies.storing.ai.DiscoverAiModelsResponse
import com.idickies.storing.ai.SaveUserAiSettingsRequest
import com.idickies.storing.ai.UserAiSettingsResponse
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Path
import retrofit2.http.Query

interface AiApi {
  @GET("ai/settings")
  suspend fun settings(): UserAiSettingsResponse

  @PUT("ai/settings")
  suspend fun save(@Body request: SaveUserAiSettingsRequest): UserAiSettingsResponse

  @DELETE("ai/settings")
  suspend fun delete(): AiSettingsDeleteResponse

  @POST("ai/models/discover")
  suspend fun discover(@Body request: DiscoverAiModelsRequest): DiscoverAiModelsResponse

  @POST("ai/settings/test")
  suspend fun test(): AiSettingsTestResponse

  @GET("ai/jobs")
  suspend fun jobs(@Query("page") page: Int, @Query("perPage") perPage: Int): AiJobsResponse

  @POST("ai/jobs/{jobId}/retry")
  suspend fun retry(@Path("jobId") jobId: Int): AiJobRetryResponse
}
