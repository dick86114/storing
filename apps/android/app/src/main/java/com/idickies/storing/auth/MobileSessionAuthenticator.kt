package com.idickies.storing.auth

/** Supplies a usable native-app access token for requests outside the main app shell, such as Android shares. */
interface MobileSessionAuthenticator {
  fun currentTokens(): SessionTokens?
  suspend fun ensureValidAccessToken(): MobileAuthResult
  suspend fun refreshAccessToken(): MobileAuthResult
}
