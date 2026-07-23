package com.idickies.storing.auth

private const val ACCESS_TOKEN_LEEWAY_MS = 30_000L

data class SessionTokens(
  val accessToken: String,
  val accessTokenExpiresAtEpochMs: Long,
  val refreshToken: String,
  val refreshTokenExpiresAtEpochMs: Long,
  val userId: Int? = null,
) {
  fun hasUsableAccessToken(nowEpochMs: Long = System.currentTimeMillis()): Boolean =
    accessToken.isNotBlank() && nowEpochMs < accessTokenExpiresAtEpochMs - ACCESS_TOKEN_LEEWAY_MS

  fun hasUsableRefreshToken(nowEpochMs: Long = System.currentTimeMillis()): Boolean =
    refreshToken.isNotBlank() && nowEpochMs < refreshTokenExpiresAtEpochMs
}
