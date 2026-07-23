package com.idickies.storing.ui.theme

import android.content.Context
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AppearancePreferences @Inject constructor(
  @ApplicationContext context: Context,
) {
  private val preferences = context.getSharedPreferences("qiankunjie_appearance", Context.MODE_PRIVATE)
  private val mutableThemeMode = MutableStateFlow(readThemeMode())
  val themeMode = mutableThemeMode.asStateFlow()

  fun setThemeMode(mode: ThemeMode) {
    preferences.edit().putString(THEME_MODE_KEY, mode.name).apply()
    mutableThemeMode.value = mode
  }

  private fun readThemeMode(): ThemeMode = preferences
    .getString(THEME_MODE_KEY, ThemeMode.System.name)
    ?.let { value -> ThemeMode.entries.firstOrNull { it.name == value } }
    ?: ThemeMode.System

  private companion object {
    const val THEME_MODE_KEY = "theme_mode"
  }
}
