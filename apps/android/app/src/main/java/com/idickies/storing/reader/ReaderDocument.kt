package com.idickies.storing.reader

/**
 * Keeps server-sanitized article markup intact and only adds the mobile
 * constraints that the Web reader applies around the same HTML fragment.
 */
object ReaderDocument {
  private val mobileHead = """
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<style id="qiankunjie-mobile-reader">
  html, body { width:100%; max-width:100%; margin:0; padding:0; overflow-x:hidden; }
  img, video, iframe, svg, canvas { display:block; max-width:100% !important; height:auto !important; }
  table { display:block; width:max-content; max-width:100% !important; overflow-x:auto; border-collapse:collapse; }
  pre, code { white-space:pre-wrap; overflow-wrap:anywhere; }
  * { box-sizing:border-box; }
</style>
""".trimIndent()

  fun forWebView(capturedHtml: String): String {
    val trimmed = capturedHtml.trim()
    if (trimmed.contains("<head", ignoreCase = true)) {
      return trimmed.replaceFirst(Regex("</head\\s*>", RegexOption.IGNORE_CASE), "$mobileHead</head>")
    }
    if (trimmed.contains("<html", ignoreCase = true)) {
      val openingHtml = Regex("<html[^>]*>", RegexOption.IGNORE_CASE).find(trimmed)?.value
      if (openingHtml != null) return trimmed.replaceFirst(openingHtml, "$openingHtml<head>$mobileHead</head>")
    }
    return "<!doctype html><html><head>$mobileHead</head><body>$trimmed</body></html>"
  }
}
