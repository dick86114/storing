package com.idickies.storing.admin

import com.idickies.storing.auth.MobileSessionAuthenticator
import kotlinx.coroutines.runBlocking
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import retrofit2.HttpException
import retrofit2.Response

class AdminRepositoryAuthenticationTest {
  @Test
  fun `user management refreshes an expired mobile session before loading users`() = runBlocking {
    val auth = FakeAuthenticator(ensureResult = true)
    val api = FakeAdminApi()
    val repository = AdminRepository(api, auth)

    repository.users()

    assertEquals(1, auth.ensureCalls)
    assertEquals(0, auth.refreshCalls)
    assertEquals(1, api.usersCalls)
  }

  @Test
  fun `user management does not call the protected endpoint when login can no longer refresh`() = runBlocking {
    val auth = FakeAuthenticator(ensureResult = false)
    val api = FakeAdminApi()
    val repository = AdminRepository(api, auth)

    val error = runCatching { repository.users() }.exceptionOrNull()

    assertTrue(error is AdminAuthenticationRequiredException)
    assertEquals(1, auth.ensureCalls)
    assertEquals(0, api.usersCalls)
  }

  @Test
  fun `user management refreshes once and retries after a stale token is rejected`() = runBlocking {
    val auth = FakeAuthenticator(ensureResult = true, refreshResult = true)
    val api = FakeAdminApi(unauthorizedUserResponsesBeforeSuccess = 1)
    val repository = AdminRepository(api, auth)

    repository.users()

    assertEquals(1, auth.ensureCalls)
    assertEquals(1, auth.refreshCalls)
    assertEquals(2, api.usersCalls)
  }

  private class FakeAuthenticator(
    private val ensureResult: Boolean,
    private val refreshResult: Boolean = true,
  ) : MobileSessionAuthenticator {
    var ensureCalls = 0
    var refreshCalls = 0

    override suspend fun ensureValidAccessToken(): Boolean {
      ensureCalls += 1
      return ensureResult
    }

    override suspend fun refreshAccessToken(): Boolean {
      refreshCalls += 1
      return refreshResult
    }
  }

  private class FakeAdminApi(
    private var unauthorizedUserResponsesBeforeSuccess: Int = 0,
  ) : AdminApi {
    var usersCalls = 0

    override suspend fun users(): AdminUsersResponse {
      usersCalls += 1
      if (unauthorizedUserResponsesBeforeSuccess > 0) {
        unauthorizedUserResponsesBeforeSuccess -= 1
        throw HttpException(Response.error<AdminUsersResponse>(401, "Unauthorized".toResponseBody("text/plain".toMediaType())))
      }
      return AdminUsersResponse(users = listOf(AdminUser(id = 1, username = "admin", role = "admin", status = "active")))
    }

    override suspend fun createUser(request: AdminCreateUserRequest): AdminUserResponse = AdminUserResponse(user())

    override suspend fun updateUser(id: Int, request: AdminUpdateUserRequest): AdminUserResponse = AdminUserResponse(user())

    override suspend fun auditLogs(limit: Int, offset: Int, targetUserId: Int?): AdminAuditLogsResponse = AdminAuditLogsResponse()

    override suspend fun mcpDefaultLimits(): AdminMcpPlatformLimits = AdminMcpPlatformLimits(60, 1_000, 2)

    override suspend fun updateMcpDefaultLimits(request: AdminMcpUpdateLimitsRequest): AdminMcpPlatformLimits = AdminMcpPlatformLimits(60, 1_000, 2)

    override suspend fun mcpClients(): AdminMcpClientsResponse = AdminMcpClientsResponse()

    override suspend fun mcpRequestLogs(limit: Int, offset: Int): AdminMcpRequestLogsResponse = AdminMcpRequestLogsResponse()

    private fun user() = AdminUser(id = 1, username = "admin", role = "admin", status = "active")
  }
}
