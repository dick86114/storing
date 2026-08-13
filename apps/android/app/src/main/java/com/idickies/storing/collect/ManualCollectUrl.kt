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
