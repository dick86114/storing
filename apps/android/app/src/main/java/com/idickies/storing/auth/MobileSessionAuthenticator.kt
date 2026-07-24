package com.idickies.storing.auth

/** Supplies a usable native-app access token for requests outside the main app shell, such as Android shares. */
interface MobileSessionAuthenticator {
  suspend fun ensureValidAccessToken(): Boolean
  suspend fun refreshAccessToken(): Boolean
}
