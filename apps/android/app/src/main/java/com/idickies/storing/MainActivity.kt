package com.idickies.storing

import android.Manifest
import android.content.pm.PackageManager
import android.os.Build
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
  private val articleId = mutableStateOf<Int?>(null)

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    sharedText.value = intent?.getStringExtra(EXTRA_SHARED_TEXT)
    articleId.value = intent?.getIntExtra(EXTRA_ARTICLE_ID, -1)?.takeIf { it > 0 }
    if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 101)
    enableEdgeToEdge()
    setContent {
      QiankunjieTheme {
        QiankunjieApp(
          sharedText = sharedText.value,
          onSharedTextConsumed = { sharedText.value = null },
          openArticleId = articleId.value,
          onArticleOpened = { articleId.value = null },
        )
      }
    }
  }

  override fun onNewIntent(intent: android.content.Intent) {
    super.onNewIntent(intent)
    sharedText.value = intent.getStringExtra(EXTRA_SHARED_TEXT)
    articleId.value = intent.getIntExtra(EXTRA_ARTICLE_ID, -1).takeIf { it > 0 }
  }

  companion object {
    const val EXTRA_SHARED_TEXT = "com.idickies.storing.extra.SHARED_TEXT"
    const val EXTRA_ARTICLE_ID = "com.idickies.storing.extra.ARTICLE_ID"
  }
}
