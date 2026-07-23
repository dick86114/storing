package com.idickies.storing.collect

import com.idickies.storing.network.MobileCollectApi
import com.idickies.storing.network.MobileCollectJob
import com.idickies.storing.network.MobileCollectRequest
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class CollectRepository @Inject constructor(
  private val api: MobileCollectApi,
) {
  suspend fun submit(url: String, source: String): MobileCollectJob =
    api.submit(MobileCollectRequest(url = url, source = source)).job

  suspend fun submitSharedUrl(url: String): MobileCollectJob = submit(url, "android_share")
  suspend fun submitManualUrl(url: String): MobileCollectJob = submit(url, "android")

  suspend fun jobs() = api.jobs().jobs
  suspend fun retry(id: Int) = api.retry(id).job
  suspend fun delete(id: Int) = api.delete(id)
  suspend fun clearFinished() = api.clearFinished()
}
