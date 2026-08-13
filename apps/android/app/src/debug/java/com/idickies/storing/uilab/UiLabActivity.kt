package com.idickies.storing.uilab

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.idickies.storing.ui.theme.QiankunjieTheme
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class UiLabActivity : ComponentActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    enableEdgeToEdge()
    setContent {
      val forcedDarkTheme = intent?.takeIf { it.hasExtra(EXTRA_FORCE_DARK_THEME) }
        ?.getBooleanExtra(EXTRA_FORCE_DARK_THEME, false)
      QiankunjieTheme(darkTheme = forcedDarkTheme ?: androidx.compose.foundation.isSystemInDarkTheme()) {
        UiLabScreen(
          initialScenario = UiLabScenario.fromRoute(intent?.getStringExtra(EXTRA_SCENARIO)),
          onClose = ::finish,
        )
      }
    }
  }

  companion object {
    const val EXTRA_SCENARIO = "com.idickies.storing.uilab.SCENARIO"
    const val EXTRA_FORCE_DARK_THEME = "com.idickies.storing.uilab.FORCE_DARK_THEME"
  }
}
