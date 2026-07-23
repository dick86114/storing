package com.idickies.storing.collect

import java.net.URI

object ManualCollectUrl {
  fun normalize(input: String): String? = runCatching {
    URI(input.trim()).takeIf { it.scheme == "http" || it.scheme == "https" }?.toString()
  }.getOrNull()
}
