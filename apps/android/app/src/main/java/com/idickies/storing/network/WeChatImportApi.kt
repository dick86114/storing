package com.idickies.storing.network

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import okhttp3.MultipartBody
import okhttp3.RequestBody
import retrofit2.http.GET
import retrofit2.http.Path
import retrofit2.http.Multipart
import retrofit2.http.POST
import retrofit2.http.Part

@Serializable
data class WeChatImportResult(
  @SerialName("articleId") val articleId: Int,
  val title: String,
  @SerialName("messageCount") val messageCount: Int,
  @SerialName("mediaCount") val mediaCount: Int,
  @SerialName("uploadedMediaCount") val uploadedMediaCount: Int,
)

@Serializable
data class WeChatImportResponse(
  @SerialName("import") val result: WeChatImportResult,
)

@Serializable
data class WeChatImportJob(
  val id: Int,
  val status: String,
  val stage: String,
  @SerialName("articleId") val articleId: Int? = null,
  val title: String? = null,
  @SerialName("messageCount") val messageCount: Int? = null,
  @SerialName("mediaCount") val mediaCount: Int? = null,
  @SerialName("uploadedMediaCount") val uploadedMediaCount: Int? = null,
  val error: String? = null,
)

@Serializable
data class WeChatImportJobResponse(
  val job: WeChatImportJob,
)

/** 微信转发文件导入；服务端负责解包、媒体上图床、入库与 AI 处理。 */
interface WeChatImportApi {
  @Multipart
  @POST("wechat/import")
  suspend fun import(
    @Part files: List<MultipartBody.Part>,
    @Part("manifest") manifest: RequestBody,
  ): WeChatImportResponse

  @Multipart
  @POST("wechat/import/jobs")
  suspend fun createJob(
    @Part files: List<MultipartBody.Part>,
    @Part("manifest") manifest: RequestBody,
  ): WeChatImportJobResponse

  @GET("wechat/import/jobs/{jobId}")
  suspend fun job(@Path("jobId") jobId: Int): WeChatImportJobResponse
}
