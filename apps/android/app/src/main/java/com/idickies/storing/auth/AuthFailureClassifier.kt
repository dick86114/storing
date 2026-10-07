package com.idickies.storing.auth

import java.io.IOException
import retrofit2.HttpException

class MobileNetworkUnavailableException : IOException("网络连接失败，请检查网络后重试")

class MobileAccountForbiddenException : IllegalStateException("账号已被禁用，请联系管理员")

private val ERROR_CODE_REGEX = """"code"\s*:\s*"([^"]+)"""".toRegex()

fun classifyAuthFailure(error: Throwable): MobileAuthResult {
  if (error is HttpException) {
    val body = runCatching { error.response()?.errorBody()?.string() }.getOrNull()
    val code = body?.let { ERROR_CODE_REGEX.find(it)?.groupValues?.get(1) }
    return when {
      error.code() in 500..599 -> MobileAuthResult.Offline
      error.code() == 403 && code == "USER_DISABLED" -> MobileAuthResult.Forbidden
      error.code() == 401 || error.code() == 403 -> MobileAuthResult.AuthenticationRequired
      else -> MobileAuthResult.Offline
    }
  }
  return MobileAuthResult.Offline
}
