package com.idickies.storing.network

import org.junit.Assert.assertEquals
import org.junit.Test

class MobileAuthResponseTest {
  @Test
  fun `mobile auth response converts server relative expiries into absolute secure-session timestamps`() {
    val response = MobileAuthResponse(
      accessToken = "access",
      accessTokenExpiresIn = 1_800,
      refreshToken = "refresh",
      refreshTokenExpiresIn = 7_776_000,
      user = MobileUser(id = 1, username = "admin", role = "admin", status = "active"),
      session = MobileSession(id = "session", expiresAt = "2026-10-21T00:00:00.000Z"),
    )

    val tokens = response.toSessionTokens(nowEpochMs = 100L)

    assertEquals(1_800_100L, tokens.accessTokenExpiresAtEpochMs)
    assertEquals(7_776_000_100L, tokens.refreshTokenExpiresAtEpochMs)
  }
}
