package com.idickies.storing.uilab

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.idickies.storing.ui.theme.QiankunjieTheme

class UiLabActivity : ComponentActivity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    enableEdgeToEdge()
    setContent {
      QiankunjieTheme {
        UiLabScreen(
          initialScenario = UiLabScenario.fromRoute(intent?.getStringExtra(EXTRA_SCENARIO)),
          onClose = ::finish,
        )
      }
    }
  }

  companion object {
    const val EXTRA_SCENARIO = "com.idickies.storing.uilab.SCENARIO"
  }
}
