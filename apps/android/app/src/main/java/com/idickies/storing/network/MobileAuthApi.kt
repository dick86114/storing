package com.idickies.storing.network

import com.idickies.storing.auth.DeviceIdentity
import com.idickies.storing.auth.SessionTokens
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

@Serializable
data class MobileDevicePayload(
  @SerialName("deviceId") val deviceId: String,
  @SerialName("deviceName") val deviceName: String,
  @SerialName("appVersion") val appVersion: String,
)

fun DeviceIdentity.toPayload() = MobileDevicePayload(deviceId, deviceName, appVersion)

@Serializable
data class MobileLoginRequest(
  val username: String,
  val password: String,
  val device: MobileDevicePayload,
)

@Serializable
data class MobileRefreshRequest(
  @SerialName("refresh_token") val refreshToken: String,
  val device: MobileDevicePayload,
)

@Serializable
data class MobileLogoutRequest(
  @SerialName("refresh_token") val refreshToken: String,
)

@Serializable
data class MobileUser(
  val id: Int,
  val username: String,
  val role: String,
  val status: String,
)

@Serializable
data class MobileSession(
  val id: String,
  @SerialName("expires_at") val expiresAt: String,
)

@Serializable
data class MobileAuthResponse(
  @SerialName("access_token") val accessToken: String,
  @SerialName("access_token_expires_in") val accessTokenExpiresIn: Long,
  @SerialName("refresh_token") val refreshToken: String,
  @SerialName("refresh_token_expires_in") val refreshTokenExpiresIn: Long,
  val user: MobileUser,
  val session: MobileSession,
) {
  fun toSessionTokens(nowEpochMs: Long = System.currentTimeMillis()) = SessionTokens(
    accessToken = accessToken,
    accessTokenExpiresAtEpochMs = nowEpochMs + accessTokenExpiresIn * 1_000,
    refreshToken = refreshToken,
    refreshTokenExpiresAtEpochMs = nowEpochMs + refreshTokenExpiresIn * 1_000,
  )
}

@Serializable
data class MobileMeResponse(val user: MobileUser)

@Serializable
data class MobileLogoutResponse(val revoked: Boolean)

@Serializable
data class MobileSessionsResponse(val sessions: List<MobileSessionInfo>)

@Serializable
data class MobileSessionInfo(
  val id: String,
  @SerialName("device_id") val deviceId: String,
  @SerialName("device_name") val deviceName: String,
  @SerialName("app_version") val appVersion: String,
  @SerialName("created_at") val createdAt: String? = null,
  @SerialName("last_used_at") val lastUsedAt: String? = null,
  @SerialName("expires_at") val expiresAt: String,
  @SerialName("revoked_at") val revokedAt: String? = null,
)

interface MobileAuthApi {
  @POST("mobile/auth/login")
  suspend fun login(@Body request: MobileLoginRequest): MobileAuthResponse

  @POST("mobile/auth/refresh")
  suspend fun refresh(@Body request: MobileRefreshRequest): MobileAuthResponse

  @POST("mobile/auth/logout")
  suspend fun logout(@Body request: MobileLogoutRequest): MobileLogoutResponse

  @GET("me")
  suspend fun me(): MobileMeResponse

  @GET("mobile/auth/sessions")
  suspend fun sessions(): MobileSessionsResponse

  @DELETE("mobile/auth/sessions/{id}")
  suspend fun revokeSession(@Path("id") sessionId: String): MobileLogoutResponse
}
