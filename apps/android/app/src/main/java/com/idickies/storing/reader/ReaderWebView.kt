package com.idickies.storing.reader

import android.net.Uri
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient

data class ReaderWebViewPolicy(
  val javaScriptEnabled: Boolean,
  val allowFileAccess: Boolean,
  val allowContentAccess: Boolean,
  val domStorageEnabled: Boolean,
  val loadWithOverviewMode: Boolean,
  val useWideViewPort: Boolean,
)

val safeReaderWebViewPolicy = ReaderWebViewPolicy(
  javaScriptEnabled = false,
  allowFileAccess = false,
  allowContentAccess = false,
  domStorageEnabled = false,
  loadWithOverviewMode = false,
  useWideViewPort = false,
)

/** Shared, deliberately limited WebView configuration for server-sanitized captured articles. */
object ReaderWebView {
  private const val baseUrl = "https://storing.idickies.com"

  fun configure(
    webView: WebView,
    preferences: ReaderPreferences = ReaderPreferences.Default,
    onOpenExternalUrl: (Uri) -> Unit,
    onPageFinished: (() -> Unit)? = null,
    onPageCommitVisible: (() -> Unit)? = null,
    onScrollChanged: ((Float) -> Unit)? = null,
  ) {
    with(webView.settings) {
      javaScriptEnabled = safeReaderWebViewPolicy.javaScriptEnabled
      allowFileAccess = safeReaderWebViewPolicy.allowFileAccess
      allowContentAccess = safeReaderWebViewPolicy.allowContentAccess
      domStorageEnabled = safeReaderWebViewPolicy.domStorageEnabled
      loadWithOverviewMode = safeReaderWebViewPolicy.loadWithOverviewMode
      useWideViewPort = safeReaderWebViewPolicy.useWideViewPort
      textZoom = preferences.textZoomPercent
    }
    webView.webViewClient = object : WebViewClient() {
      override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
        val uri = request?.url ?: return true
        if (uri.scheme == "http" || uri.scheme == "https") onOpenExternalUrl(uri)
        return true
      }

      override fun onPageFinished(view: WebView?, url: String?) {
        onPageFinished?.invoke()
      }

      override fun onPageCommitVisible(view: WebView?, url: String?) {
        onPageCommitVisible?.invoke()
      }
    }
    if (onScrollChanged != null) {
      webView.setOnScrollChangeListener { _, _, _, _, _ ->
        val contentHeight = webView.contentHeight
        if (contentHeight > 0) {
          val maxScroll = contentHeight - webView.height
          if (maxScroll > 0) {
            onScrollChanged(webView.scrollY.toFloat() / maxScroll)
          }
        }
      }
    }
  }

  /** Restore the reading position as a percentage (0..1) of total scrollable content. */
  fun restoreScrollPosition(webView: WebView, percentage: Float) {
    webView.post {
      val contentHeight = webView.contentHeight
      if (contentHeight > 0) {
        val maxScroll = contentHeight - webView.height
        if (maxScroll > 0) {
          webView.scrollTo(0, (maxScroll * percentage.coerceIn(0f, 1f)).toInt())
        }
      }
    }
  }

  fun loadCapturedHtml(
    webView: WebView,
    capturedHtml: String,
    colorScheme: ReaderColorScheme = ReaderColorScheme.Light,
    preferences: ReaderPreferences = ReaderPreferences.Default,
    headerHtml: String = "",
  ) {
    webView.loadDataWithBaseURL(baseUrl, ReaderDocument.forWebView(capturedHtml, colorScheme, preferences, headerHtml), "text/html", "UTF-8", null)
  }
}
