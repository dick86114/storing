package com.idickies.storing.collect

import java.net.URI

object SharedUrlExtractor {
  private val urlPattern = Regex("""https?://[^\s<>()，。！？]+""", RegexOption.IGNORE_CASE)

  fun extract(text: String): List<String> = urlPattern.findAll(text)
    .map { it.value.trimEnd('.', ',', '，', '。', '！', '？', ')', ']', '}') }
    .mapNotNull { raw -> runCatching { URI(raw) }.getOrNull()?.takeIf { it.scheme == "http" || it.scheme == "https" }?.toString() }
    .distinct()
    .toList()
}
