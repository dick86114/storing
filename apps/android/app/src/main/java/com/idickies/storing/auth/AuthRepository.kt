package com.idickies.storing.auth

import com.idickies.storing.network.MobileAuthApi
import com.idickies.storing.network.MobileLoginRequest
import com.idickies.storing.network.MobileLogoutRequest
import com.idickies.storing.network.MobileRefreshRequest
import com.idickies.storing.network.MobileUser
import com.idickies.storing.network.toPayload
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthRepository @Inject constructor(
  private val api: MobileAuthApi,
  private val sessionStore: SessionStore,
  private val deviceIdentityProvider: DeviceIdentityProvider,
) {
  fun currentTokens(): SessionTokens? = sessionStore.read()

  suspend fun login(username: String, password: String): MobileUser {
    val response = api.login(MobileLoginRequest(username, password, deviceIdentityProvider.current().toPayload()))
    sessionStore.write(response.toSessionTokens())
    return response.user
  }

  suspend fun restoreSession(): MobileUser? {
    val tokens = sessionStore.read() ?: return null
    if (tokens.hasUsableAccessToken()) {
      val user = runCatching { api.me().user }.getOrNull()
      if (user != null) return user
    }
    return refresh()
  }

  suspend fun refresh(): MobileUser? {
    val tokens = sessionStore.read() ?: return null
    if (!tokens.hasUsableRefreshToken()) {
      sessionStore.clear()
      return null
    }
    return runCatching {
      api.refresh(MobileRefreshRequest(tokens.refreshToken, deviceIdentityProvider.current().toPayload()))
    }.mapCatching { response ->
      sessionStore.write(response.toSessionTokens())
      response.user
    }.getOrElse {
      sessionStore.clear()
      null
    }
  }

  suspend fun logout() {
    val tokens = sessionStore.read()
    sessionStore.clear()
    if (tokens?.hasUsableRefreshToken() == true) runCatching { api.logout(MobileLogoutRequest(tokens.refreshToken)) }
  }
}
