package com.idickies.storing.collect

import com.idickies.storing.auth.MobileSessionAuthenticator
import com.idickies.storing.auth.MobileAuthResult
import com.idickies.storing.network.WeChatImportApi
import com.idickies.storing.network.WeChatImportJob
import com.idickies.storing.network.WeChatImportResult
import okhttp3.MultipartBody
import okhttp3.RequestBody
import retrofit2.HttpException
import kotlinx.coroutines.delay
import kotlinx.coroutines.withTimeout
import java.io.IOException
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class WeChatImportRepository @Inject constructor(
  private val api: WeChatImportApi,
  private val sessionAuthenticator: MobileSessionAuthenticator,
) {
  suspend fun import(files: List<MultipartBody.Part>, manifest: RequestBody): WeChatImportResult =
    authenticatedRequest { api.import(files, manifest).result }

  suspend fun importWithQueue(
    files: List<MultipartBody.Part>,
    manifest: RequestBody,
    onQueued: suspend (WeChatImportJob) -> Unit = {},
  ): WeChatImportResult {
    val created = authenticatedRequest { api.createJob(files, manifest).job }
    onQueued(created)

    return withTimeout(QUEUE_TIMEOUT_MILLIS) {
      val startedAtNanos = System.nanoTime()
      var job = created
      var consecutiveFailures = 0
      while (job.status == "pending" || job.status == "running") {
        val elapsedMillis = (System.nanoTime() - startedAtNanos) / 1_000_000
        delay(ShareImportPollPolicy.intervalMillis(elapsedMillis, consecutiveFailures))
        try {
          job = authenticatedRequest { api.job(job.id).job }
          consecutiveFailures = 0
        } catch (error: IOException) {
          // 轮询网络抖动不能判定导入失败；任务仍在服务端队列里，退避后再查。
          consecutiveFailures += 1
          continue
        }
      }

      if (job.status != "completed") {
        throw IOException(job.error ?: "微信内容导入失败")
      }
      WeChatImportResult(
        articleId = requireNotNull(job.articleId),
        title = requireNotNull(job.title),
        messageCount = requireNotNull(job.messageCount),
        mediaCount = requireNotNull(job.mediaCount),
        uploadedMediaCount = requireNotNull(job.uploadedMediaCount),
      )
    }
  }

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

  private companion object {
    const val QUEUE_TIMEOUT_MILLIS = 30 * 60_000L
  }
}
