package com.idickies.storing.ui

import android.content.Context
import androidx.lifecycle.ViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

fun shouldShowFloatingCollectButton(isAuthenticated: Boolean, settingEnabled: Boolean): Boolean =
  isAuthenticated && settingEnabled

@Singleton
class FloatingCollectPreferences @Inject constructor(
  @ApplicationContext context: Context,
) {
  private val preferences = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
  private val mutableEnabled = MutableStateFlow(preferences.getBoolean(KEY_ENABLED, true))
  val enabled = mutableEnabled.asStateFlow()

  fun setEnabled(enabled: Boolean) {
    preferences.edit().putBoolean(KEY_ENABLED, enabled).apply()
    mutableEnabled.value = enabled
  }

  private companion object {
    const val PREFERENCES_NAME = "qiankunjie_floating_collect"
    const val KEY_ENABLED = "enabled"
  }
}

@HiltViewModel
class FloatingCollectViewModel @Inject constructor(
  private val preferences: FloatingCollectPreferences,
) : ViewModel() {
  val enabled = preferences.enabled

  fun setEnabled(enabled: Boolean) = preferences.setEnabled(enabled)
}
