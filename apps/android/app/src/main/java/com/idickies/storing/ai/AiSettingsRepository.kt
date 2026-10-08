package com.idickies.storing.ai

import com.idickies.storing.network.AiApi
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AiSettingsRepository @Inject constructor(private val api: AiApi) {
  suspend fun settings() = api.settings()
  suspend fun save(request: SaveUserAiSettingsRequest) = api.save(request)
  suspend fun delete() = api.delete()
  suspend fun discover(request: DiscoverAiModelsRequest) = api.discover(request)
  suspend fun test() = api.test()
  suspend fun jobs(page: Int = 1, perPage: Int = 10) = api.jobs(page, perPage)
  suspend fun retry(jobId: Int) = api.retry(jobId)
}
