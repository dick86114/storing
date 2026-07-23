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
}
