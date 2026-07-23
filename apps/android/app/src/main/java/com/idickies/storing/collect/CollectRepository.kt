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
  suspend fun submitSharedUrl(url: String): MobileCollectJob =
    api.submit(MobileCollectRequest(url = url, source = "android_share")).job

  suspend fun jobs() = api.jobs().jobs
  suspend fun retry(id: Int) = api.retry(id).job
  suspend fun delete(id: Int) = api.delete(id)
  suspend fun clearFinished() = api.clearFinished()
}
