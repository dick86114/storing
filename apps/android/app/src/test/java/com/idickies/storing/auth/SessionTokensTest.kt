package com.idickies.storing.auth

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class SessionTokensTest {
  @Test
  fun `access token is treated as expired before a request reaches its exact expiry`() {
    val tokens = SessionTokens(
      accessToken = "access",
      accessTokenExpiresAtEpochMs = 100_000L,
      refreshToken = "refresh",
      refreshTokenExpiresAtEpochMs = 1_000_000L,
    )

    assertTrue(tokens.hasUsableAccessToken(nowEpochMs = 69_999L))
    assertFalse(tokens.hasUsableAccessToken(nowEpochMs = 70_000L))
    assertTrue(tokens.hasUsableRefreshToken(nowEpochMs = 999_999L))
    assertFalse(tokens.hasUsableRefreshToken(nowEpochMs = 1_000_000L))
  }
}
