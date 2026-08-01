package com.idickies.storing.admin

import com.idickies.storing.auth.MobileSessionAuthenticator
import retrofit2.HttpException
import javax.inject.Inject
import javax.inject.Singleton

class AdminAuthenticationRequiredException : IllegalStateException(
  "登录已失效，请打开乾坤戒后重新登录",
)

/**
 * Authenticated boundary for all administrator-only operations.
 *
 * AccessTokenInterceptor deliberately omits expired tokens, so protected calls must refresh before
 * request dispatch and retry one time when the backend rejects a token that became stale in transit.
 */
@Singleton
class AdminRepository @Inject constructor(
  private val api: AdminApi,
  private val sessionAuthenticator: MobileSessionAuthenticator,
) {
  suspend fun users() = authenticatedRequest { api.users().users }

  suspend fun createUser(request: AdminCreateUserRequest) = authenticatedRequest { api.createUser(request).user }

  suspend fun updateUser(id: Int, request: AdminUpdateUserRequest) = authenticatedRequest { api.updateUser(id, request).user }

  suspend fun deleteUser(id: Int, confirmUsername: String) = authenticatedRequest { api.deleteUser(id, AdminDeleteUserRequest(confirmUsername)) }

  suspend fun auditLogs() = authenticatedRequest { api.auditLogs().logs }

  suspend fun mcpDefaultLimits() = authenticatedRequest { api.mcpDefaultLimits() }

  suspend fun updateMcpDefaultLimits(request: AdminMcpUpdateLimitsRequest) =
    authenticatedRequest { api.updateMcpDefaultLimits(request) }

  suspend fun mcpClients() = authenticatedRequest { api.mcpClients().clients }

  suspend fun mcpRequestLogs() = authenticatedRequest { api.mcpRequestLogs().logs }

  private suspend fun <T> authenticatedRequest(request: suspend () -> T): T {
    if (!sessionAuthenticator.ensureValidAccessToken()) throw AdminAuthenticationRequiredException()

    try {
      return request()
    } catch (error: HttpException) {
      if (error.code() != 401) throw error
    }

    if (!sessionAuthenticator.refreshAccessToken()) throw AdminAuthenticationRequiredException()
    try {
      return request()
    } catch (error: HttpException) {
      if (error.code() == 401) throw AdminAuthenticationRequiredException()
      throw error
    }
  }
}
