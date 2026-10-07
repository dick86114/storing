package com.idickies.storing.auth

import com.idickies.storing.network.ChangePasswordRequest
import com.idickies.storing.network.MobileAuthApi
import com.idickies.storing.network.MobileAuthResponse
import com.idickies.storing.network.MobileLoginRequest
import com.idickies.storing.network.MobileLogoutRequest
import com.idickies.storing.network.MobileRefreshRequest
import com.idickies.storing.network.MobileSession
import com.idickies.storing.network.MobileUser
import java.io.IOException
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.delay
import kotlinx.coroutines.runBlocking
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import retrofit2.HttpException
import retrofit2.Response

class AuthRepositoryTest {
  @Test
  fun `网络失败保留刷新令牌`() = runBlocking {
    val store = FakeSessionStore(tokens())
    val api = FakeAuthApi(refreshError = IOException("offline"))
    val repository = AuthRepository(api, store, FakeDeviceIdentity)

    assertEquals(MobileAuthResult.Offline, repository.refreshAccessToken())
    assertEquals("old", store.read()?.refreshToken)
  }

  @Test
  fun `认证失效清除本地会话而禁用账号保留`() = runBlocking {
    val expiredStore = FakeSessionStore(tokens())
    val expiredRepository = AuthRepository(FakeAuthApi(refreshError = authException(401)), expiredStore, FakeDeviceIdentity)
    assertEquals(MobileAuthResult.AuthenticationRequired, expiredRepository.refreshAccessToken())
    assertNull(expiredStore.read())

    val disabledStore = FakeSessionStore(tokens())
    val disabledRepository = AuthRepository(FakeAuthApi(refreshError = authException(403)), disabledStore, FakeDeviceIdentity)
    assertEquals(MobileAuthResult.Forbidden, disabledRepository.refreshAccessToken())
    assertNotNull(disabledStore.read())
  }

  @Test
  fun `并发刷新只请求一次且迟到结果不覆盖新令牌`() = runBlocking {
    val store = FakeSessionStore(tokens())
    val api = FakeAuthApi()
    val repository = AuthRepository(api, store, FakeDeviceIdentity)

    (1..20).map { async { repository.refreshAccessToken() } }.awaitAll()
      .forEach { result -> assertTrue(result is MobileAuthResult.Available) }

    assertEquals(1, api.refreshCalls)
    assertEquals("new", store.read()?.refreshToken)

    store.write(tokens(refreshToken = "newer"))
    repository.storeRefreshResponse(response(refreshToken = "late"), oldRefreshToken = "old")
    assertEquals("newer", store.read()?.refreshToken)
  }

  @Test
  fun `访问令牌有效时不刷新`() = runBlocking {
    val store = FakeSessionStore(tokens())
    val api = FakeAuthApi()
    val repository = AuthRepository(api, store, FakeDeviceIdentity)

    assertTrue(repository.ensureValidAccessToken() is MobileAuthResult.Available)
    assertEquals(0, api.refreshCalls)
  }

  private fun tokens(refreshToken: String = "old") = SessionTokens(
    accessToken = "access",
    accessTokenExpiresAtEpochMs = Long.MAX_VALUE,
    refreshToken = refreshToken,
    refreshTokenExpiresAtEpochMs = Long.MAX_VALUE,
    userId = 7,
  )

  private fun authException(code: Int): HttpException {
    val body = """{"error":{"code":"${if (code == 403) "USER_DISABLED" else "INVALID_REFRESH_TOKEN"}"}}"""
    return HttpException(Response.error<Any>(code, body.toResponseBody("application/json".toMediaType())))
  }

  private fun response(refreshToken: String) = MobileAuthResponse(
    accessToken = "next-access",
    accessTokenExpiresIn = 1_800,
    refreshToken = refreshToken,
    refreshTokenExpiresIn = 7_776_000,
    user = MobileUser(7, "reader", "user", "active"),
    session = MobileSession("session", "2027-01-05T00:00:00.000Z"),
  )

  private object FakeDeviceIdentity : DeviceIdentitySource {
    override fun current() = DeviceIdentity("3a7c0d2b-f9f2-4b64-a87e-453d4a24c5fe", "Test", "1.0")
  }

  private class FakeSessionStore(initial: SessionTokens?) : SessionStore {
    private var value: SessionTokens? = initial
    override fun read(): SessionTokens? = value
    override fun write(tokens: SessionTokens) { value = tokens }
    override fun clear() { value = null }
  }

  private class FakeAuthApi(
    private var refreshError: Throwable? = null,
  ) : MobileAuthApi {
    var refreshCalls = 0
    override suspend fun login(request: MobileLoginRequest) = response("login")
    override suspend fun refresh(request: MobileRefreshRequest): MobileAuthResponse {
      delay(10)
      refreshCalls += 1
      refreshError?.let { throw it }
      return response("new")
    }
    override suspend fun logout(request: MobileLogoutRequest) = throw UnsupportedOperationException()
    override suspend fun me() = throw UnsupportedOperationException()
    override suspend fun sessions() = throw UnsupportedOperationException()
    override suspend fun revokeSession(sessionId: String) = throw UnsupportedOperationException()
    override suspend fun changePassword(request: ChangePasswordRequest) = throw UnsupportedOperationException()
    private fun response(refreshToken: String) = MobileAuthResponse(
      accessToken = "access",
      accessTokenExpiresIn = 1_800,
      refreshToken = refreshToken,
      refreshTokenExpiresIn = 7_776_000,
      user = MobileUser(7, "reader", "user", "active"),
      session = MobileSession("session", "2027-01-05T00:00:00.000Z"),
    )
  }
}
