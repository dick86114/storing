package com.idickies.storing.collect

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.BackoffPolicy
import androidx.work.Constraints
import androidx.work.CoroutineWorker
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.WorkManager
import androidx.work.WorkerParameters
import com.idickies.storing.auth.MobileAuthResult
import com.idickies.storing.auth.MobileSessionAuthenticator
import com.idickies.storing.database.PendingCollectSubmissionDao
import com.idickies.storing.network.MobileCollectApi
import com.idickies.storing.network.MobileCollectRequest
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject
import java.util.concurrent.TimeUnit

@HiltWorker
class PendingCollectSubmissionWorker @AssistedInject constructor(
  @Assisted appContext: Context,
  @Assisted params: WorkerParameters,
  private val sessionAuthenticator: MobileSessionAuthenticator,
  private val pendingSubmissionDao: PendingCollectSubmissionDao,
  private val collectApi: MobileCollectApi,
) : CoroutineWorker(appContext, params) {
  override suspend fun doWork(): Result {
    when (sessionAuthenticator.ensureValidAccessToken()) {
      is MobileAuthResult.Available -> Unit
      MobileAuthResult.Offline, MobileAuthResult.AuthenticationRequired -> return Result.retry()
      MobileAuthResult.Forbidden -> return Result.failure()
    }

    val userId = sessionAuthenticator.currentTokens()?.userId ?: return Result.success()
    repeat(MAX_SUBMISSIONS_PER_RUN) {
      val pending = pendingSubmissionDao.next(userId) ?: return Result.success()
      val job = runCatching { collectApi.submit(MobileCollectRequest(pending.url, pending.source)).job }
        .getOrElse { return Result.retry() }
      pendingSubmissionDao.delete(pending.id)
      CollectTrackingScheduler.schedule(applicationContext, job.id)
    }
    return Result.success()
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
