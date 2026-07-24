package com.idickies.storing.collect

import com.idickies.storing.auth.MobileSessionAuthenticator
import com.idickies.storing.network.MobileCollectApi
import com.idickies.storing.network.MobileCollectJob
import com.idickies.storing.network.MobileCollectRequest
import retrofit2.HttpException
import javax.inject.Inject
import javax.inject.Singleton

class MobileAuthenticationRequiredException : IllegalStateException(
  "登录已失效，请打开乾坤戒后重新登录",
)

@Singleton
class CollectRepository @Inject constructor(
  private val api: MobileCollectApi,
  private val sessionAuthenticator: MobileSessionAuthenticator,
) {
  suspend fun submit(url: String, source: String): MobileCollectJob =
    authenticatedRequest { api.submit(MobileCollectRequest(url = url, source = source)).job }

  suspend fun submitSharedUrl(url: String): MobileCollectJob = submit(url, "android_share")
  suspend fun submitManualUrl(url: String): MobileCollectJob = submit(url, "android")

  suspend fun jobs() = authenticatedRequest { api.jobs().jobs }
  suspend fun retry(id: Int) = authenticatedRequest { api.retry(id).job }
  suspend fun delete(id: Int) = authenticatedRequest { api.delete(id) }
  suspend fun clearFinished() = authenticatedRequest { api.clearFinished() }

  private suspend fun <T> authenticatedRequest(request: suspend () -> T): T {
    if (!sessionAuthenticator.ensureValidAccessToken()) throw MobileAuthenticationRequiredException()

    try {
      return request()
    } catch (error: HttpException) {
      if (error.code() != 401) throw error
    }

    if (!sessionAuthenticator.refreshAccessToken()) throw MobileAuthenticationRequiredException()
    try {
      return request()
    } catch (error: HttpException) {
      if (error.code() == 401) throw MobileAuthenticationRequiredException()
      throw error
    }
  }
}
