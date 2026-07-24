package com.idickies.storing.security

import android.content.Context
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class BiometricPreferences @Inject constructor(
  @ApplicationContext context: Context,
) {
  private val prefs = context.getSharedPreferences("qiankunjie_biometric", Context.MODE_PRIVATE)
  private val mutableEnabled = MutableStateFlow(prefs.getBoolean(KEY_ENABLED, false))
  val enabled = mutableEnabled.asStateFlow()

  fun setEnabled(enabled: Boolean) {
    prefs.edit().putBoolean(KEY_ENABLED, enabled).apply()
    mutableEnabled.value = enabled
  }

  fun recordBackgrounded() {
    prefs.edit().putLong(KEY_LAST_BG, System.currentTimeMillis()).apply()
  }

  /** Returns true if the app should be locked (was backgrounded longer than the timeout). */
  fun shouldLock(): Boolean {
    if (!mutableEnabled.value) return false
    val lastBg = prefs.getLong(KEY_LAST_BG, 0)
    if (lastBg == 0L) return false
    val elapsed = System.currentTimeMillis() - lastBg
    return elapsed >= LOCK_TIMEOUT_MS
  }

  fun clearBackgroundTimestamp() {
    prefs.edit().remove(KEY_LAST_BG).apply()
  }

  private companion object {
    const val KEY_ENABLED = "enabled"
    const val KEY_LAST_BG = "last_bg"
    const val LOCK_TIMEOUT_MS = 30_000L // 30 seconds
  }
}
