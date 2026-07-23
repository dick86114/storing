package com.idickies.storing.collect

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.idickies.storing.ApiConfiguration
import com.idickies.storing.auth.DeviceIdentityProvider
import com.idickies.storing.auth.KeystoreSessionStore
import com.idickies.storing.database.ArticleCacheDatabase
import com.idickies.storing.network.AccessTokenInterceptor
import com.idickies.storing.network.ClientHeadersInterceptor
import com.idickies.storing.network.KotlinxSerializationFactory
import com.idickies.storing.network.MobileAuthApi
import com.idickies.storing.network.MobileCollectApi
import com.idickies.storing.network.MobileCollectRequest
import com.idickies.storing.network.MobileRefreshRequest
import com.idickies.storing.network.toPayload
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import java.util.concurrent.TimeUnit

class PendingCollectSubmissionWorker(appContext: Context, params: WorkerParameters) : CoroutineWorker(appContext, params) {
  override suspend fun doWork(): Result {
    val sessionStore = KeystoreSessionStore(applicationContext)
    val tokens = sessionStore.read() ?: return Result.success()
    val userId = tokens.userId ?: return Result.success()
    val identity = DeviceIdentityProvider(applicationContext)
    val retrofit = Retrofit.Builder()
      .baseUrl(ApiConfiguration.baseUrl)
      .client(
        OkHttpClient.Builder()
          .addInterceptor(ClientHeadersInterceptor(identity))
          .addInterceptor(AccessTokenInterceptor(sessionStore))
          .build(),
      )
      .addConverterFactory(KotlinxSerializationFactory.create(Json { ignoreUnknownKeys = true; explicitNulls = false }))
      .build()
    if (!tokens.hasUsableAccessToken()) {
      if (!tokens.hasUsableRefreshToken()) return Result.success()
      val refreshed = runCatching {
        retrofit.create(MobileAuthApi::class.java)
          .refresh(MobileRefreshRequest(tokens.refreshToken, identity.current().toPayload()))
      }.getOrElse { return Result.retry() }
      sessionStore.write(refreshed.toSessionTokens())
    }

    val dao = ArticleCacheDatabase.create(applicationContext).pendingCollectSubmissionDao()
    val collectApi = retrofit.create(MobileCollectApi::class.java)
    repeat(MAX_SUBMISSIONS_PER_RUN) {
      val pending = dao.next(userId) ?: return Result.success()
      val job = runCatching { collectApi.submit(MobileCollectRequest(pending.url, pending.source)).job }
        .getOrElse { return Result.retry() }
      dao.delete(pending.id)
      CollectTrackingScheduler.schedule(applicationContext, job.id)
    }
    return Result.retry()
  }

  private companion object {
    const val MAX_SUBMISSIONS_PER_RUN = 10
  }
}

object PendingCollectSubmissionScheduler {
  private const val WORK_NAME = "pending-collect-submissions"

  fun schedule(context: Context) {
    val request = OneTimeWorkRequestBuilder<PendingCollectSubmissionWorker>()
      .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
      .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 10, TimeUnit.SECONDS)
      .build()
    WorkManager.getInstance(context).enqueueUniqueWork(WORK_NAME, ExistingWorkPolicy.KEEP, request)
  }
}
