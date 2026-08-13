package com.idickies.storing

import android.Manifest
import android.content.ClipboardManager
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.mutableStateOf
import androidx.fragment.app.FragmentActivity
import com.idickies.storing.ui.QiankunjieApp
import com.idickies.storing.collect.ManualCollectUrl
import com.idickies.storing.collect.ClipboardCollectCandidate
import com.idickies.storing.collect.clipboardUrlToPrompt
import dagger.hilt.android.AndroidEntryPoint

@AndroidEntryPoint
class MainActivity : FragmentActivity() {
  private val sharedText = mutableStateOf<String?>(null)
  private val articleId = mutableStateOf<Int?>(null)
  private val publicId = mutableStateOf<String?>(null)
  private val collectJobId = mutableStateOf<Int?>(null)
  private val openMcpSettings = mutableStateOf(false)
  private val clipboardCollectUrl = mutableStateOf<String?>(null)
  private var lastClipboardPrompted: ClipboardCollectCandidate? = null

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    handleIntent(intent)
    checkClipboardForCollectionPrompt()
    if (Build.VERSION.SDK_INT >= 33 && checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
      requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 101)
    }
    enableEdgeToEdge()
    setContent {
      QiankunjieApp(
        sharedText = sharedText.value,
        onSharedTextConsumed = { sharedText.value = null },
        openArticleId = articleId.value,
        onArticleOpened = { articleId.value = null },
        openPublicId = publicId.value,
        onPublicIdOpened = { publicId.value = null },
        openCollectJobs = collectJobId.value != null,
        onCollectJobsOpened = { collectJobId.value = null },
        openMcpSettings = openMcpSettings.value,
        onMcpSettingsOpened = { openMcpSettings.value = false },
        clipboardCollectUrl = clipboardCollectUrl.value,
        onClipboardCollectUrlConsumed = { clipboardCollectUrl.value = null },
      )
    }
  }

  override fun onNewIntent(intent: Intent) {
    super.onNewIntent(intent)
    handleIntent(intent)
  }

  override fun onResume() {
    super.onResume()
    checkClipboardForCollectionPrompt()
  }

  private fun handleIntent(intent: Intent?) {
    intent ?: return

    // Share text
    intent.getStringExtra(EXTRA_SHARED_TEXT)?.let {
      sharedText.value = it
    }

    when (intent.action) {
      Intent.ACTION_VIEW -> {
        val uri = intent.data ?: return
        when (uri.scheme) {
          "https" -> {
            // App Link: https://storing.idickies.com/p/:publicId
            if (uri.host == "storing.idickies.com" && uri.path?.startsWith("/p/") == true) {
              val id = uri.path?.removePrefix("/p/")?.trim()
              if (!id.isNullOrBlank()) publicId.value = id
            }
          }
          "qiankunjie" -> {
            when (uri.host) {
              "article" -> {
                // qiankunjie://article/:id
                val id = uri.path?.trimStart('/')?.toIntOrNull()
                if (id != null && id > 0) articleId.value = id
              }
              "collect" -> {
                // qiankunjie://collect/job/:id
                if (uri.path?.startsWith("/job/") == true) {
                  val id = uri.path?.removePrefix("/job/")?.toIntOrNull()
                  if (id != null && id > 0) collectJobId.value = id
                }
              }
              "settings" -> {
                // qiankunjie://settings/mcp
                if (uri.path?.startsWith("/mcp") == true) {
                  openMcpSettings.value = true
                }
              }
            }
          }
        }
      }
      Intent.ACTION_SEND -> {
        // Handled by ShareReceiverActivity, but handle here too for safety
        intent.getStringExtra(Intent.EXTRA_TEXT)?.let { text ->
          if (text.isNotBlank()) sharedText.value = text
        }
      }
    }
  }

  private fun readClipboardCollectCandidate(): ClipboardCollectCandidate? {
    val clipboard = getSystemService(ClipboardManager::class.java) ?: return null
    val clip = clipboard.primaryClip ?: return null
    val url = ManualCollectUrl.fromClipboardText(clip.getItemAt(0).coerceToText(this)) ?: return null
    return ClipboardCollectCandidate(url = url, timestamp = clip.description.timestamp)
  }

  private fun checkClipboardForCollectionPrompt() {
    val current = readClipboardCollectCandidate()
    val promptUrl = clipboardUrlToPrompt(
      current = current,
      pendingUrl = clipboardCollectUrl.value,
      lastPrompted = lastClipboardPrompted,
    )
    if (current == null) lastClipboardPrompted = null
    if (promptUrl != null) {
      clipboardCollectUrl.value = promptUrl.url
      lastClipboardPrompted = promptUrl
    }
  }

  companion object {
    const val EXTRA_SHARED_TEXT = "com.idickies.storing.extra.SHARED_TEXT"
    const val EXTRA_ARTICLE_ID = "com.idickies.storing.extra.ARTICLE_ID"
    const val EXTRA_COLLECT_JOB_ID = "com.idickies.storing.extra.COLLECT_JOB_ID"
  }
}
