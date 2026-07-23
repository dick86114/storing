package com.idickies.storing

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.mutableStateOf
import com.idickies.storing.ui.QiankunjieApp
import com.idickies.storing.ui.theme.QiankunjieTheme
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : ComponentActivity() {
  private val sharedText = mutableStateOf<String?>(null)

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    sharedText.value = intent?.getStringExtra(EXTRA_SHARED_TEXT)
    enableEdgeToEdge()
    setContent {
      QiankunjieTheme {
        QiankunjieApp(sharedText = sharedText.value, onSharedTextConsumed = { sharedText.value = null })
      }
    }
  }

  override fun onNewIntent(intent: android.content.Intent) {
    super.onNewIntent(intent)
    sharedText.value = intent.getStringExtra(EXTRA_SHARED_TEXT)
  }

  companion object {
    const val EXTRA_SHARED_TEXT = "com.idickies.storing.extra.SHARED_TEXT"
  }
}
