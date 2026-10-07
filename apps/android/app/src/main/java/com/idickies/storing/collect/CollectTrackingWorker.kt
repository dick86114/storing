package com.idickies.storing.collect

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.Data
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.idickies.storing.auth.MobileAuthResult
import com.idickies.storing.auth.MobileSessionAuthenticator
import com.idickies.storing.network.MobileCollectApi
import com.idickies.storing.notification.CollectNotificationHelper
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import java.util.concurrent.TimeUnit

@HiltWorker
class CollectTrackingWorker @AssistedInject constructor(
  @Assisted appContext: Context,
  @Assisted params: WorkerParameters,
  private val sessionAuthenticator: MobileSessionAuthenticator,
  private val api: MobileCollectApi,
) : CoroutineWorker(appContext, params) {
  override suspend fun doWork(): Result {
    val jobId = inputData.getInt(KEY_JOB_ID, -1)
    if (jobId < 1) return Result.failure()

    when (sessionAuthenticator.ensureValidAccessToken()) {
      is MobileAuthResult.Available -> Unit
      MobileAuthResult.Offline, MobileAuthResult.AuthenticationRequired -> return Result.retry()
      MobileAuthResult.Forbidden -> return Result.failure()
    }

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
