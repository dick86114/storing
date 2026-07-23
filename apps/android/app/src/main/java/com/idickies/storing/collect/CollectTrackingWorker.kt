package com.idickies.storing.collect

import android.content.Context
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.Data
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.idickies.storing.ApiConfiguration
import com.idickies.storing.auth.DeviceIdentityProvider
import com.idickies.storing.auth.KeystoreSessionStore
import com.idickies.storing.network.AccessTokenInterceptor
import com.idickies.storing.network.ClientHeadersInterceptor
import com.idickies.storing.network.KotlinxSerializationFactory
import com.idickies.storing.network.MobileAuthApi
import com.idickies.storing.network.MobileCollectApi
import com.idickies.storing.network.MobileRefreshRequest
import com.idickies.storing.network.toPayload
import com.idickies.storing.notification.CollectNotificationHelper
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import java.util.concurrent.TimeUnit

class CollectTrackingWorker(appContext: Context, params: WorkerParameters) : CoroutineWorker(appContext, params) {
  override suspend fun doWork(): Result {
    val jobId = inputData.getInt(KEY_JOB_ID, -1)
    if (jobId < 1) return Result.failure()

    val sessionStore = KeystoreSessionStore(applicationContext)
    val identity = DeviceIdentityProvider(applicationContext)
    val client = OkHttpClient.Builder()
      .addInterceptor(ClientHeadersInterceptor(identity))
      .addInterceptor(AccessTokenInterceptor(sessionStore))
      .build()
    val retrofit = Retrofit.Builder()
      .baseUrl(ApiConfiguration.baseUrl)
      .client(client)
      .addConverterFactory(KotlinxSerializationFactory.create(Json { ignoreUnknownKeys = true; explicitNulls = false }))
      .build()
    val tokens = sessionStore.read() ?: return Result.failure()
    if (!tokens.hasUsableAccessToken()) {
      if (!tokens.hasUsableRefreshToken()) return Result.failure()
      val refreshed = runCatching {
        retrofit.create(MobileAuthApi::class.java)
          .refresh(MobileRefreshRequest(tokens.refreshToken, identity.current().toPayload()))
      }.getOrElse { return Result.retry() }
      sessionStore.write(refreshed.toSessionTokens())
    }
    val api = retrofit.create(MobileCollectApi::class.java)
    val job = runCatching { api.job(jobId).job }.getOrElse { return Result.retry() }
    if (!CollectNotificationPolicy.shouldNotify(job)) return Result.retry()
    CollectNotificationHelper.notify(applicationContext, job)
    return Result.success()
  }

  companion object {
    const val KEY_JOB_ID = "collect_job_id"
  }
}

object CollectTrackingScheduler {
  fun schedule(context: Context, jobId: Int) {
    val request = OneTimeWorkRequestBuilder<CollectTrackingWorker>()
      .setInputData(Data.Builder().putInt(CollectTrackingWorker.KEY_JOB_ID, jobId).build())
      .setConstraints(Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build())
      .setBackoffCriteria(BackoffPolicy.EXPONENTIAL, 10, TimeUnit.SECONDS)
      .addTag("collect-$jobId")
      .build()
    WorkManager.getInstance(context).enqueueUniqueWork("collect-$jobId", ExistingWorkPolicy.REPLACE, request)
  }
}
