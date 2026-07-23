package com.idickies.storing.network

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

@Serializable
data class MobileCollectRequest(
  val url: String,
  val source: String,
)

@Serializable
data class MobileCollectJob(
  val id: Int,
  val url: String,
  @SerialName("normalizedUrl") val normalizedUrl: String,
  val status: String,
  val stage: String,
  val method: String? = null,
  @SerialName("captureStrategy") val captureStrategy: String? = null,
  @SerialName("articleId") val articleId: Int? = null,
  val title: String? = null,
  @SerialName("errorSummary") val errorSummary: String? = null,
  @SerialName("errorHint") val errorHint: String? = null,
) {
  val isTerminal: Boolean get() = status == "completed" || status == "failed"
}

@Serializable
data class MobileCollectJobResponse(val job: MobileCollectJob)

@Serializable
data class MobileCollectJobsResponse(
  val jobs: List<MobileCollectJob> = emptyList(),
  val total: Int = 0,
  @SerialName("hasMore") val hasMore: Boolean = false,
)

@Serializable
data class MobileCollectDeleteResponse(
  val deleted: Boolean? = null,
  @SerialName("deletedCount") val deletedCount: Int? = null,
)

interface MobileCollectApi {
  @POST("mobile/collect")
  suspend fun submit(@Body request: MobileCollectRequest): MobileCollectJobResponse

  @GET("mobile/collect/jobs")
  suspend fun jobs(@Query("limit") limit: Int = 30, @Query("offset") offset: Int = 0): MobileCollectJobsResponse

  @GET("mobile/collect/jobs/{id}")
  suspend fun job(@Path("id") id: Int): MobileCollectJobResponse

  @POST("mobile/collect/jobs/{id}/retry")
  suspend fun retry(@Path("id") id: Int): MobileCollectJobResponse

  @DELETE("mobile/collect/jobs/{id}")
  suspend fun delete(@Path("id") id: Int): MobileCollectDeleteResponse

  @DELETE("mobile/collect/jobs")
  suspend fun clearFinished(): MobileCollectDeleteResponse
}
