package com.idickies.storing.collect

import com.idickies.storing.auth.MobileSessionAuthenticator
import com.idickies.storing.auth.MobileAuthResult
import com.idickies.storing.network.WeChatImportApi
import com.idickies.storing.network.WeChatImportResult
import okhttp3.MultipartBody
import okhttp3.RequestBody
import retrofit2.HttpException
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class WeChatImportRepository @Inject constructor(
  private val api: WeChatImportApi,
  private val sessionAuthenticator: MobileSessionAuthenticator,
) {
  suspend fun import(files: List<MultipartBody.Part>, manifest: RequestBody): WeChatImportResult =
    authenticatedRequest { api.import(files, manifest).result }

  private suspend fun <T> authenticatedRequest(request: suspend () -> T): T {
    requireAuthenticated(sessionAuthenticator.ensureValidAccessToken())

    try {
      return request()
    } catch (error: HttpException) {
      if (error.code() != 401) throw error
    }

    requireAuthenticated(sessionAuthenticator.refreshAccessToken())
    try {
      return request()
    } catch (error: HttpException) {
      if (error.code() == 401) throw MobileAuthenticationRequiredException()
      throw error
    }
  }

  private suspend fun requireAuthenticated(result: MobileAuthResult) {
    when (result) {
      is MobileAuthResult.Available -> Unit
      MobileAuthResult.Offline -> throw com.idickies.storing.auth.MobileNetworkUnavailableException()
      MobileAuthResult.Forbidden -> throw com.idickies.storing.auth.MobileAccountForbiddenException()
      MobileAuthResult.AuthenticationRequired -> throw MobileAuthenticationRequiredException()
    }
  }
}
