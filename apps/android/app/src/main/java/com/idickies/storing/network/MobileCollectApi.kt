package com.idickies.storing.network

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import retrofit2.http.Body
import retrofit2.http.POST

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
  @SerialName("articleId") val articleId: Int? = null,
  val title: String? = null,
  @SerialName("errorSummary") val errorSummary: String? = null,
)

@Serializable
data class MobileCollectJobResponse(val job: MobileCollectJob)

interface MobileCollectApi {
  @POST("mobile/collect")
  suspend fun submit(@Body request: MobileCollectRequest): MobileCollectJobResponse
}
