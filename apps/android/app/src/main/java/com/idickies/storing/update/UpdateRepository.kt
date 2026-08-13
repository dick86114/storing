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

  fun updateSource(): UpdateSource {
    val saved = preferences.getString(KEY_UPDATE_SOURCE, SOURCE_OFFICIAL) ?: SOURCE_OFFICIAL
    return when {
      saved == SOURCE_GH_PROXY -> UpdateSource.GhProxy
      saved.startsWith("custom:") -> UpdateSource.Custom(saved.removePrefix("custom:"))
      else -> UpdateSource.Official
    }
  }

  fun setUpdateSource(source: UpdateSource) {
    val value = when (source) {
      UpdateSource.Official -> SOURCE_OFFICIAL
      UpdateSource.GhProxy -> SOURCE_GH_PROXY
      is UpdateSource.Custom -> if (source.isInvalid) return else "custom:${source.prefixForStorage()}"
    }
    preferences.edit().putString(KEY_UPDATE_SOURCE, value).apply()
  }

  suspend fun checkOnLaunch(): AndroidRelease? = check(force = false)

  suspend fun checkNow(): AndroidRelease? = check(force = true)

  private suspend fun check(force: Boolean): AndroidRelease? {
    if (BuildConfig.DEBUG) return null
    val now = System.currentTimeMillis()
    if (!UpdateCheckPolicy.shouldRequest(preferences.getLong(KEY_LAST_CHECK, 0L), now, force)) return null
    preferences.edit().putLong(KEY_LAST_CHECK, now).apply()
    val response = api.latest(BuildConfig.VERSION_CODE)
    if (!response.isSuccessful) {
      val statusCode = response.code()
      val kind = if (statusCode == 408 || statusCode == 429 || statusCode >= 500) {
        UpdateFailureKind.Server
      } else {
        UpdateFailureKind.Other
      }
      throw UpdateCheckException(statusCode, "更新源返回 HTTP $statusCode", kind)
    }
    val release = response.body()
    if (release != null && preferences.getInt(KEY_IGNORED_VERSION_CODE, 0) == release.versionCode &&
      AndroidReleaseUpdatePolicy.canIgnore(BuildConfig.VERSION_CODE, release)
    ) return null
    return release
  }

  fun ignore(release: AndroidRelease) {
    if (AndroidReleaseUpdatePolicy.canIgnore(BuildConfig.VERSION_CODE, release)) {
      preferences.edit().putInt(KEY_IGNORED_VERSION_CODE, release.versionCode).apply()
    }
  }

  private companion object {
    const val KEY_LAST_CHECK = "last_check"
    const val KEY_IGNORED_VERSION_CODE = "ignored_version_code"
    const val KEY_UPDATE_SOURCE = "update_source"
    const val SOURCE_OFFICIAL = "official"
    const val SOURCE_GH_PROXY = "gh_proxy"
  }
}
