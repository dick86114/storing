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

  fun configure(webView: WebView, onOpenExternalUrl: (Uri) -> Unit) {
    with(webView.settings) {
      javaScriptEnabled = safeReaderWebViewPolicy.javaScriptEnabled
      allowFileAccess = safeReaderWebViewPolicy.allowFileAccess
      allowContentAccess = safeReaderWebViewPolicy.allowContentAccess
      domStorageEnabled = safeReaderWebViewPolicy.domStorageEnabled
      loadWithOverviewMode = safeReaderWebViewPolicy.loadWithOverviewMode
      useWideViewPort = safeReaderWebViewPolicy.useWideViewPort
    }
    webView.webViewClient = object : WebViewClient() {
      override fun shouldOverrideUrlLoading(view: WebView?, request: WebResourceRequest?): Boolean {
        val uri = request?.url ?: return true
        if (uri.scheme == "http" || uri.scheme == "https") onOpenExternalUrl(uri)
        return true
      }
    }
  }

  fun loadCapturedHtml(webView: WebView, capturedHtml: String) {
    webView.loadDataWithBaseURL(baseUrl, ReaderDocument.forWebView(capturedHtml), "text/html", "UTF-8", null)
  }
}
