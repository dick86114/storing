package com.idickies.storing.auth

import java.net.SocketTimeoutException
import java.net.UnknownHostException
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.ResponseBody.Companion.toResponseBody
import org.junit.Assert.assertEquals
import org.junit.Test
import retrofit2.HttpException
import retrofit2.Response

class AuthFailureClassifierTest {
  @Test
  fun `网络异常归类为离线并保留令牌`() {
    assertEquals(MobileAuthResult.Offline, classifyAuthFailure(java.io.IOException("offline")))
    assertEquals(MobileAuthResult.Offline, classifyAuthFailure(SocketTimeoutException("timeout")))
    assertEquals(MobileAuthResult.Offline, classifyAuthFailure(UnknownHostException("api")))
  }

  @Test
  fun `服务端认证错误归类为需要重新登录`() {
    assertEquals(MobileAuthResult.AuthenticationRequired, classifyAuthFailure(httpException(401, """{"error":{"code":"INVALID_REFRESH_TOKEN"}}""")))
    assertEquals(MobileAuthResult.AuthenticationRequired, classifyAuthFailure(httpException(401, "unparsable")))
  }

  @Test
  fun `禁用账号归类为禁止并且保留令牌`() {
    assertEquals(MobileAuthResult.Forbidden, classifyAuthFailure(httpException(403, """{"error":{"code":"USER_DISABLED"}}""")))
  }

  @Test
  fun `服务器和网络故障归类为离线`() {
    assertEquals(MobileAuthResult.Offline, classifyAuthFailure(httpException(502, "bad gateway")))
  }

  private fun httpException(code: Int, body: String): HttpException {
    val response = Response.error<Any>(code, body.toResponseBody("application/json".toMediaType()))
    return HttpException(response)
  }
}
