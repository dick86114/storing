package com.idickies.storing.auth

import com.idickies.storing.network.ChangePasswordRequest
import com.idickies.storing.network.MobileAuthApi
import com.idickies.storing.network.MobileAuthResponse
import com.idickies.storing.network.MobileLoginRequest
import com.idickies.storing.network.MobileLogoutRequest
import com.idickies.storing.network.MobileRefreshRequest
import com.idickies.storing.network.MobileSessionInfo
import com.idickies.storing.network.MobileUser
import com.idickies.storing.network.toPayload
import javax.inject.Inject
import javax.inject.Singleton
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import retrofit2.HttpException

@Singleton
class AuthRepository @Inject constructor(
  private val api: MobileAuthApi,
  private val sessionStore: SessionStore,
  private val deviceIdentitySource: DeviceIdentitySource,
) : MobileSessionAuthenticator {
  private val refreshMutex = Mutex()
  private var cachedUser: MobileUser? = null
  private var lastRefreshedToken: String? = null

  override fun currentTokens(): SessionTokens? = sessionStore.read()

  suspend fun login(username: String, password: String): MobileUser {
    val response = api.login(MobileLoginRequest(username, password, deviceIdentitySource.current().toPayload()))
    sessionStore.write(response.toSessionTokens())
    cachedUser = response.user
    lastRefreshedToken = response.refreshToken
    return response.user
  }

  override suspend fun ensureValidAccessToken(): MobileAuthResult {
    val tokens = sessionStore.read()
    if (tokens?.hasUsableAccessToken() == true) {
      return MobileAuthResult.Available(fallbackUser(tokens.userId))
    }
    return refreshAccessToken()
  }

  override suspend fun refreshAccessToken(): MobileAuthResult = refreshAccessToken(force = false)

  override suspend fun recoverAccessToken(): MobileAuthResult = refreshAccessToken(force = true)

  private suspend fun refreshAccessToken(force: Boolean): MobileAuthResult = refreshMutex.withLock {
    val oldTokens = sessionStore.read()
    if (oldTokens == null || !oldTokens.hasUsableRefreshToken()) {
      sessionStore.clear()
      return@withLock MobileAuthResult.AuthenticationRequired
    }
    if (!force && lastRefreshedToken == oldTokens.refreshToken) {
      return@withLock MobileAuthResult.Available(fallbackUser(oldTokens.userId))
    }

    try {
      val response = api.refresh(MobileRefreshRequest(oldTokens.refreshToken, deviceIdentitySource.current().toPayload()))
      storeRefreshResponse(response, oldTokens.refreshToken)
    } catch (error: HttpException) {
      val result = classifyAuthFailure(error)
      if (result is MobileAuthResult.AuthenticationRequired && sessionStore.read()?.refreshToken == oldTokens.refreshToken) {
        sessionStore.clear()
      }
      result
    } catch (error: CancellationException) {
      throw error
    } catch (_: Exception) {
      MobileAuthResult.Offline
    }
  }

  internal suspend fun storeRefreshResponse(response: MobileAuthResponse, oldRefreshToken: String): MobileAuthResult {
    if (sessionStore.read()?.refreshToken == oldRefreshToken) {
      sessionStore.write(response.toSessionTokens())
      lastRefreshedToken = response.refreshToken
    }
    cachedUser = response.user
    return MobileAuthResult.Available(response.user)
  }

  suspend fun restoreSession(): MobileAuthResult {
    val tokens = sessionStore.read() ?: return MobileAuthResult.AuthenticationRequired
    if (tokens.hasUsableAccessToken()) {
      val user = try {
        api.me().user
      } catch (error: HttpException) {
        val classified = classifyAuthFailure(error)
        return if (classified is MobileAuthResult.AuthenticationRequired) refreshAccessToken() else classified
      } catch (error: CancellationException) {
        throw error
      } catch (_: Exception) {
        return MobileAuthResult.Offline
      }
      cachedUser = user
      if (tokens.userId != user.id) sessionStore.write(tokens.copy(userId = user.id))
      return MobileAuthResult.Available(user)
    }
    return refreshAccessToken()
  }

  suspend fun sessions(): List<MobileSessionInfo> {
    requireAuthenticatedAccess { ensureValidAccessToken() }
    return api.sessions().sessions
  }

  suspend fun revokeSession(sessionId: String): Boolean {
    requireAuthenticatedAccess { ensureValidAccessToken() }
    return api.revokeSession(sessionId).revoked
  }

  suspend fun changePassword(currentPassword: String, newPassword: String): Boolean {
    requireAuthenticatedAccess { ensureValidAccessToken() }
    api.changePassword(ChangePasswordRequest(currentPassword, newPassword))
    sessionStore.clear()
    return true
  }

  suspend fun logout() {
    val tokens = sessionStore.read()
    sessionStore.clear()
    cachedUser = null
    lastRefreshedToken = null
    if (tokens?.hasUsableRefreshToken() == true) runCatching { api.logout(MobileLogoutRequest(tokens.refreshToken)) }
  }

  private suspend inline fun requireAuthenticatedAccess(request: () -> MobileAuthResult) {
    when (val result = request()) {
      is MobileAuthResult.Available -> Unit
      MobileAuthResult.Offline -> throw MobileNetworkUnavailableException()
      MobileAuthResult.Forbidden -> throw MobileAccountForbiddenException()
      MobileAuthResult.AuthenticationRequired -> throw IllegalStateException("登录已失效，请打开乾坤戒后重新登录")
    }
  }

  private fun fallbackUser(userId: Int?) = cachedUser ?: MobileUser(
    id = userId ?: 0,
    username = "",
    role = "user",
    status = "active",
  )
}
