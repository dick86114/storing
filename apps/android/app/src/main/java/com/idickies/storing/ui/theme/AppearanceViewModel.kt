package com.idickies.storing.ui.theme

import androidx.lifecycle.ViewModel
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.StateFlow
import javax.inject.Inject

@HiltViewModel
class AppearanceViewModel @Inject constructor(
  private val preferences: AppearancePreferences,
) : ViewModel() {
  val themeMode: StateFlow<ThemeMode> = preferences.themeMode

  fun selectThemeMode(mode: ThemeMode) = preferences.setThemeMode(mode)
}
