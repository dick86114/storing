package com.idickies.storing.network

import com.idickies.storing.auth.DeviceIdentityProvider
import okhttp3.Interceptor
import okhttp3.Response

class ClientHeadersInterceptor(
  private val deviceIdentityProvider: DeviceIdentityProvider,
) : Interceptor {
  override fun intercept(chain: Interceptor.Chain): Response {
    val identity = deviceIdentityProvider.current()
    return chain.proceed(
      chain.request().newBuilder()
        .header("X-Storing-Client", "android")
        .header("X-Storing-App-Version", identity.appVersion)
        .header("X-Storing-Device-Id", identity.deviceId)
        .build(),
    )
  }
}


class AccessTokenInterceptor(
  private val sessionStore: com.idickies.storing.auth.SessionStore,
) : Interceptor {
  override fun intercept(chain: Interceptor.Chain): Response {
    val request = chain.request()
    if (request.header("Authorization") != null) return chain.proceed(request)
    val accessToken = sessionStore.read()?.takeIf { it.hasUsableAccessToken() }?.accessToken
      ?: return chain.proceed(request)
    return chain.proceed(request.newBuilder().header("Authorization", "Bearer $accessToken").build())
  }
}
