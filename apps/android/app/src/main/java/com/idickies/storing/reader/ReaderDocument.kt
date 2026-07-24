package com.idickies.storing.reader

/**
 * Keeps server-sanitized article markup intact and only adds the mobile
 * constraints that the Web reader applies around the same HTML fragment.
 */
enum class ReaderColorScheme { Light, Dark }

object ReaderDocument {
  private fun mobileHead(colorScheme: ReaderColorScheme, preferences: ReaderPreferences): String {
    val darkTheme = if (colorScheme == ReaderColorScheme.Dark) """
  html { color-scheme:dark; background:#2E3440; }
  body { background:#2E3440 !important; color:#ECEFF4 !important; }
  body :where(h1,h2,h3,h4,h5,h6,p,li,blockquote,figcaption,td,th,span,strong,em,small,a,code,pre) { color:#ECEFF4 !important; }
  body :where(section,article,main,header,footer,div,blockquote,pre,table,thead,tbody,tr,td,th) { background-color:transparent !important; border-color:#4C566A !important; }
  body a { color:#88C0D0 !important; }
""".trimIndent() else """
  html { color-scheme:light; background:#FFFCF8; }
  body { background:#FFFCF8; color:#1D1B19; }
""".trimIndent()
    return """
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<style id="qiankunjie-mobile-reader">
  html, body { width:100%; max-width:100%; margin:0; overflow-x:hidden; }
  html { -webkit-text-size-adjust:100%; text-size-adjust:100%; }
  body { padding:0 ${preferences.horizontalPaddingPx}px 32px; line-height:${preferences.lineHeight}; }
  body :where(p,li,blockquote,figcaption,td,th) { line-height:${preferences.lineHeight}; }
  img, video, iframe, svg, canvas { display:block; max-width:100% !important; height:auto !important; }
  table { display:block; width:max-content; max-width:none !important; overflow-x:auto; -webkit-overflow-scrolling:touch; border-collapse:collapse; }
  pre, code { white-space:pre-wrap; overflow-wrap:anywhere; }
  blockquote, p, li { overflow-wrap:anywhere; }
  * { box-sizing:border-box; }
$darkTheme
</style>
""".trimIndent()
  }

  fun forWebView(
    capturedHtml: String,
    colorScheme: ReaderColorScheme = ReaderColorScheme.Light,
    preferences: ReaderPreferences = ReaderPreferences.Default,
  ): String {
    val mobileHead = mobileHead(colorScheme, preferences)
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
