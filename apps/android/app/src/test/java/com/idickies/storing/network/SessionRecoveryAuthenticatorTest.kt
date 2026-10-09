package com.idickies.storing.network

import com.idickies.storing.auth.MobileAuthResult
import com.idickies.storing.auth.MobileSessionAuthenticator
import com.idickies.storing.auth.SessionTokens
import com.idickies.storing.network.MobileUser
import javax.inject.Provider
import okhttp3.Protocol
import okhttp3.Request
import okhttp3.Response
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test

class SessionRecoveryAuthenticatorTest {
  @Test
  fun `403 recovers session once and retries with refreshed access token`() {
    val session = FakeRecoveringSession()
    val authenticator = SessionRecoveryAuthenticator(Provider { session })
    val request = Request.Builder()
      .url("https://storing.idickies.cc/api/v1/articles/42")
      .build()
    val response = Response.Builder()
      .request(request)
      .protocol(Protocol.HTTP_1_1)
      .code(403)
      .message("Forbidden")
      .body("""{"error":{"code":"FORBIDDEN"}}""".toResponseBody())
      .build()

    val retried = authenticator.authenticate(null, response)

    assertNotNull(retried)
    assertEquals("Bearer refreshed-access", retried?.header("Authorization"))
    assertEquals(1, session.recoverCalls)
  }

  private class FakeRecoveringSession : MobileSessionAuthenticator {
    var recoverCalls = 0
    private var tokens = SessionTokens(
      accessToken = "stale-access",
      accessTokenExpiresAtEpochMs = Long.MAX_VALUE,
      refreshToken = "refresh",
      refreshTokenExpiresAtEpochMs = Long.MAX_VALUE,
      userId = 7,
    )

    override fun currentTokens(): SessionTokens = tokens

    override suspend fun ensureValidAccessToken(): MobileAuthResult =
      MobileAuthResult.Available(user())

    override suspend fun refreshAccessToken(): MobileAuthResult =
      MobileAuthResult.Available(user())

    override suspend fun recoverAccessToken(): MobileAuthResult {
      recoverCalls += 1
      tokens = tokens.copy(accessToken = "refreshed-access")
      return MobileAuthResult.Available(user())
    }

    private fun user() = MobileUser(7, "reader", "user", "active")
  }
}
