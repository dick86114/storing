package com.idickies.storing.collect

import com.idickies.storing.auth.MobileSessionAuthenticator
import com.idickies.storing.network.MobileCollectApi
import com.idickies.storing.network.MobileCollectDeleteResponse
import com.idickies.storing.network.MobileCollectJob
import com.idickies.storing.network.MobileCollectJobResponse
import com.idickies.storing.network.MobileCollectJobsResponse
import com.idickies.storing.network.MobileCollectRequest
import kotlinx.coroutines.runBlocking
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import retrofit2.HttpException
import retrofit2.Response

class CollectRepositoryAuthenticationTest {
  @Test
  fun `submission refreshes an expired mobile session before calling the protected endpoint`() = runBlocking {
    val auth = FakeAuthenticator(ensureResult = true)
    val api = FakeMobileCollectApi()
    val repository = CollectRepository(api, auth)

    repository.submitSharedUrl("https://example.com/article")

    assertEquals(1, auth.ensureCalls)
    assertEquals(0, auth.refreshCalls)
    assertEquals(1, api.submitCalls)
  }

  @Test
  fun `submission reports an expired login locally instead of calling the protected endpoint`() = runBlocking {
    val auth = FakeAuthenticator(ensureResult = false)
    val api = FakeMobileCollectApi()
    val repository = CollectRepository(api, auth)

    val error = runCatching { repository.submitSharedUrl("https://example.com/article") }.exceptionOrNull()

    assertTrue(error is MobileAuthenticationRequiredException)
    assertEquals(1, auth.ensureCalls)
    assertEquals(0, api.submitCalls)
  }

  @Test
  fun `submission refreshes once and retries when the server rejects a stale access token`() = runBlocking {
    val auth = FakeAuthenticator(ensureResult = true, refreshResult = true)
    val api = FakeMobileCollectApi(unauthorizedResponsesBeforeSuccess = 1)
    val repository = CollectRepository(api, auth)

    repository.submitSharedUrl("https://example.com/article")

    assertEquals(1, auth.ensureCalls)
    assertEquals(1, auth.refreshCalls)
    assertEquals(2, api.submitCalls)
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

  private class FakeMobileCollectApi(
    private var unauthorizedResponsesBeforeSuccess: Int = 0,
  ) : MobileCollectApi {
    var submitCalls = 0

    override suspend fun submit(request: MobileCollectRequest): MobileCollectJobResponse {
      submitCalls += 1
      if (unauthorizedResponsesBeforeSuccess > 0) {
        unauthorizedResponsesBeforeSuccess -= 1
        throw HttpException(Response.error<MobileCollectJobResponse>(401, "Unauthorized".toResponseBody("text/plain".toMediaType())))
      }
      return MobileCollectJobResponse(job())
    }

    override suspend fun jobs(limit: Int, offset: Int) = MobileCollectJobsResponse()
    override suspend fun job(id: Int) = MobileCollectJobResponse(job())
    override suspend fun retry(id: Int) = MobileCollectJobResponse(job())
    override suspend fun delete(id: Int) = MobileCollectDeleteResponse()
    override suspend fun clearFinished() = MobileCollectDeleteResponse()

    private fun job() = MobileCollectJob(
      id = 7,
      url = "https://example.com/article",
      normalizedUrl = "https://example.com/article",
      status = "pending",
      stage = "queued",
    )
  }
}
