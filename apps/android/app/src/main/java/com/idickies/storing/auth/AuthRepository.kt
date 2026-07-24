package com.idickies.storing.auth

import com.idickies.storing.network.ChangePasswordRequest
import com.idickies.storing.network.MobileAuthApi
import com.idickies.storing.network.MobileLoginRequest
import com.idickies.storing.network.MobileLogoutRequest
import com.idickies.storing.network.MobileRefreshRequest
import com.idickies.storing.network.MobileSessionInfo
import com.idickies.storing.network.MobileUser
import com.idickies.storing.network.toPayload
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthRepository @Inject constructor(
  private val api: MobileAuthApi,
  private val sessionStore: SessionStore,
  private val deviceIdentityProvider: DeviceIdentityProvider,
) : MobileSessionAuthenticator {
  fun currentTokens(): SessionTokens? = sessionStore.read()

  suspend fun login(username: String, password: String): MobileUser {
    val response = api.login(MobileLoginRequest(username, password, deviceIdentityProvider.current().toPayload()))
    sessionStore.write(response.toSessionTokens())
    return response.user
  }

  override suspend fun ensureValidAccessToken(): Boolean {
    if (sessionStore.read()?.hasUsableAccessToken() == true) return true
    return refreshAccessToken()
  }

  override suspend fun refreshAccessToken(): Boolean = refresh() != null

  suspend fun restoreSession(): MobileUser? {
    val tokens = sessionStore.read() ?: return null
    if (tokens.hasUsableAccessToken()) {
      val user = runCatching { api.me().user }.getOrNull()
      if (user != null) {
        if (tokens.userId != user.id) sessionStore.write(tokens.copy(userId = user.id))
        return user
      }
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

  suspend fun sessions(): List<MobileSessionInfo> {
    if (!ensureValidAccessToken()) return emptyList()
    return api.sessions().sessions
  }

  suspend fun revokeSession(sessionId: String): Boolean {
    if (!ensureValidAccessToken()) return false
    return api.revokeSession(sessionId).revoked
  }

  suspend fun changePassword(currentPassword: String, newPassword: String): Boolean {
    if (!ensureValidAccessToken()) return false
    api.changePassword(ChangePasswordRequest(currentPassword, newPassword))
    // Password change revokes all mobile sessions server-side, so clear local session
    sessionStore.clear()
    return true
  }

  suspend fun logout() {
    val tokens = sessionStore.read()
    sessionStore.clear()
    if (tokens?.hasUsableRefreshToken() == true) runCatching { api.logout(MobileLogoutRequest(tokens.refreshToken)) }
  }
}
