package com.idickies.storing.network

import com.idickies.storing.auth.MobileAuthResult
import com.idickies.storing.auth.MobileSessionAuthenticator
import javax.inject.Inject
import javax.inject.Provider
import javax.inject.Singleton
import kotlinx.coroutines.runBlocking
import okhttp3.Authenticator
import okhttp3.Request
import okhttp3.Response

@Singleton
class SessionRecoveryAuthenticator @Inject constructor(
  private val sessionAuthenticator: Provider<MobileSessionAuthenticator>,
) : Authenticator {
  override fun authenticate(route: okhttp3.Route?, response: Response): Request? {
    if (response.code != 401 && response.code != 403) return null
    if (response.request.url.encodedPath.contains("/auth/")) return null
    if (responseCount(response) >= 2) return null

    val authenticator = sessionAuthenticator.get()
    val result = runBlocking { authenticator.recoverAccessToken() }
    if (result !is MobileAuthResult.Available) return null

    val accessToken = authenticator.currentTokens()?.accessToken
      ?.takeIf { it.isNotBlank() }
      ?: return null
    return response.request.newBuilder()
      .header("Authorization", "Bearer $accessToken")
      .build()
  }

  private fun responseCount(response: Response): Int {
    var count = 1
    var prior = response.priorResponse
    while (prior != null) {
      count += 1
      prior = prior.priorResponse
    }
    return count
  }
}
