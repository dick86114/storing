package com.idickies.storing.update

import android.content.Context
import com.idickies.storing.BuildConfig
import com.idickies.storing.network.MobileReleaseApi
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class UpdateRepository @Inject constructor(
  private val api: MobileReleaseApi,
  @ApplicationContext context: Context,
) {
  private val preferences = context.getSharedPreferences("qiankunjie_update_check", Context.MODE_PRIVATE)

  suspend fun checkOnLaunch(): AndroidRelease? {
    if (BuildConfig.DEBUG) return null
    val now = System.currentTimeMillis()
    if (now - preferences.getLong(KEY_LAST_CHECK, 0L) < DAILY_CHECK_INTERVAL_MS) return null
    preferences.edit().putLong(KEY_LAST_CHECK, now).apply()
    val response = api.latest(BuildConfig.VERSION_CODE)
    return if (response.isSuccessful) response.body() else null
  }

  private companion object {
    const val KEY_LAST_CHECK = "last_check"
    const val DAILY_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1_000L
  }
}
