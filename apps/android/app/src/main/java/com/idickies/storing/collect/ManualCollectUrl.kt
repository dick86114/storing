package com.idickies.storing.collect

import java.net.URI

object ManualCollectUrl {
  fun normalize(input: String): String? = runCatching {
    URI(input.trim()).takeIf { it.scheme == "http" || it.scheme == "https" }?.toString()
  }.getOrNull()

  fun fromClipboardText(text: CharSequence?): String? = text
    ?.toString()
    ?.let(::normalize)
    ?: text?.toString()?.let(SharedUrlExtractor::extract)?.firstOrNull()
}

internal data class ClipboardCollectCandidate(
  val url: String,
  val timestamp: Long,
)

/** 前台恢复时只提示尚未展示过的剪贴板链接，避免同一份内容重复弹窗。 */
internal fun clipboardUrlToPrompt(
  current: ClipboardCollectCandidate?,
  pendingUrl: String?,
  lastPrompted: ClipboardCollectCandidate?,
): ClipboardCollectCandidate? = when {
  current == null -> null
  pendingUrl != null -> null
  current == lastPrompted -> null
  else -> current
}
