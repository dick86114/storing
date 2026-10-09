package com.idickies.storing.reader

import com.idickies.storing.library.ArticleDetail

/**
 * Keeps server-sanitized article markup intact and only adds the mobile
 * constraints that the Web reader applies around the same HTML fragment.
 */
enum class ReaderColorScheme { Light, Dark }

object ReaderDocument {
  private fun mobileHead(colorScheme: ReaderColorScheme, preferences: ReaderPreferences): String {
    val darkTheme = if (colorScheme == ReaderColorScheme.Dark) """
  html { color-scheme:dark; background:#071A12 !important; }
  body { background:#071A12 !important; color:#E8E4DC !important; }
  body :where(h1,h2,h3,h4,h5,h6,p,li,blockquote,figcaption,td,th,span,strong,em,small,a,code,pre) { color:#E8E4DC !important; }
  body *:not(img):not(video):not(picture):not(source):not(canvas):not(svg) { background-color:transparent !important; background-image:none !important; }
  body :where(section,article,main,header,footer,div,blockquote,pre,table,thead,tbody,tr,td,th,ul,ol,li,figure,figcaption,aside,nav) { background-color:transparent !important; border-color:#1C3A2B !important; }
  body a { color:#C9A84C !important; }
  body :where(pre,code) { background:#0E2419 !important; color:#E8E4DC !important; }
""".trimIndent() else """
  html { color-scheme:light; background:#F2F8F3; }
  body { background:#F2F8F3; color:#1A2E24; }
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
$qiankunjieReaderHeader
$darkTheme
</style>
""".trimIndent()
  }

  /** 文章详情头部样式 -- 对齐设计稿（古卷书斋） */
  private val qiankunjieReaderHeader = """
  .qj-header { padding:20px 0 0; margin-bottom:20px; }
  .qj-source-tag { display:inline-flex; align-items:center; gap:4px; font-size:11px; padding:3px 10px; border-radius:99px; font-weight:500; }
  .qj-source-web { background:#E8F0F7; color:#2A5A8A; }
  .qj-source-wechat { background:#E8F4EC; color:#1E7A3A; }
  .qj-source-icon { width:12px; height:12px; flex-shrink:0; }
  .qj-title { font-size:24px; font-weight:700; line-height:1.3; margin:0 0 12px; font-family:'Noto Serif SC',serif; color:#1A2E24; }
  .qj-meta { display:flex; align-items:center; gap:8px; font-size:12px; margin-bottom:20px; flex-wrap:wrap; color:#8FA897; }
  .qj-meta-source { color:#5A7062; font-weight:500; }
  .qj-meta-sep { opacity:0.8; }
  details.qj-ai-card { background:#F8FCF9; border-radius:12px; padding:16px; margin-bottom:24px; border:1px solid rgba(104,156,120,0.20); position:relative; overflow:hidden; }
  details.qj-ai-card::before { content:''; position:absolute; left:0; top:12px; bottom:12px; width:3px; background:#B8912A; border-radius:0 2px 2px 0; }
  details.qj-ai-card > summary { list-style:none; cursor:pointer; -webkit-tap-highlight-color:transparent; outline:none; }
  details.qj-ai-card > summary::-webkit-details-marker { display:none; }
  .qj-ai-header { display:flex; align-items:center; gap:6px; margin-bottom:8px; padding-left:8px; }
  .qj-ai-icon { width:14px; height:14px; flex-shrink:0; }
  .qj-ai-label { font-size:12px; font-weight:600; color:#B8912A; }
  .qj-ai-spacer { flex:1 1 auto; }
  .qj-ai-status { display:inline-flex; align-items:center; border-radius:99px; padding:2px 8px; font-size:10px; font-weight:600; line-height:1.4; white-space:nowrap; }
  .qj-ai-status-pending { background:#FFF6DA; color:#8A6A18; }
  .qj-ai-status-running { background:#E6F3EA; color:#227044; }
  .qj-ai-status-failed { background:#FCE8E6; color:#A13B35; }
  .qj-ai-status-muted { background:#EEF2EF; color:#637368; }
  .qj-ai-toggle { margin-left:6px; display:flex; align-items:center; padding:4px; color:#8FA897; }
  .qj-ai-toggle svg { width:16px; height:16px; transition:transform 0.2s ease; }
  details.qj-ai-card:not([open]) .qj-ai-toggle svg { transform:rotate(-90deg); }
  details.qj-ai-card:not([open]) .qj-ai-header { margin-bottom:0; }
  .qj-ai-body { font-size:13px; line-height:1.6; color:#5A7062; padding-left:8px; }
  .qj-ai-body p { margin:0; }
  .qj-ai-status-message { margin-top:8px; }
  .qj-ai-error { margin-top:8px; color:#A13B35; overflow-wrap:anywhere; }
  .qj-ai-meta { display:flex; flex-wrap:wrap; gap:10px; margin-top:8px; font-size:11px; color:#7A8D80; }
  .qj-tags { display:flex; gap:6px; flex-wrap:wrap; margin-bottom:16px; }
  .qj-tag { font-size:11px; padding:3px 10px; border-radius:99px; background:#D0E8D8; color:#0D2B1E; }
  .qj-offline { font-size:11px; color:#1E7A3A; margin-bottom:12px; }
  details.qj-category-review { position:relative; display:inline-flex; align-items:center; color:#8A7541; font-size:12px; }
  details.qj-category-review > summary { list-style:none; display:inline-flex; align-items:center; justify-content:center; width:14px; height:14px; cursor:pointer; outline:none; -webkit-tap-highlight-color:transparent; }
  details.qj-category-review > summary::-webkit-details-marker { display:none; }
  details.qj-category-review > summary svg { width:12px; height:12px; }
  details.qj-category-review .qj-category-review-body {
    position:fixed; top:50%; left:16px; right:16px; z-index:80;
    width:auto; max-width:520px; margin:0 auto; padding:14px 16px; border-radius:12px;
    transform:translateY(-50%);
    background:#F8FCF9; border:1px solid rgba(104,156,120,0.24); color:#5A7062;
    line-height:1.6; box-shadow:0 12px 28px rgba(13,43,30,0.16);
    overflow-wrap:anywhere; word-break:break-word;
  }
  .qj-category-review-title { display:block; margin-bottom:6px; font-weight:600; color:#8A7541; }
  .qj-category-review-reason { display:block; overflow-wrap:anywhere; word-break:break-word; }
""".trimIndent()

  /** 深色模式头部覆盖样式 */
  private val darkHeaderOverride = """
  .qj-source-web { background:rgba(26,74,74,0.5) !important; color:rgba(110,231,183,0.9) !important; }
  .qj-source-wechat { background:rgba(30,58,44,0.6) !important; color:rgba(110,231,183,0.9) !important; }
  .qj-title { color:#E8E4DC !important; }
  .qj-meta { color:#6B7A6F !important; }
  .qj-meta-source { color:#9CA89F !important; }
  details.qj-ai-card { background:rgba(201,168,76,0.05) !important; border-color:rgba(201,168,76,0.2) !important; }
  details.qj-ai-card::before { background:#C9A84C !important; }
  .qj-ai-label { color:#C9A84C !important; }
  .qj-ai-toggle { color:rgba(201,168,76,0.6) !important; }
  .qj-ai-body { color:#9CA89F !important; }
  .qj-ai-status-pending { background:#3A3117 !important; color:#E7C766 !important; }
  .qj-ai-status-running { background:#173326 !important; color:#87D6A9 !important; }
  .qj-ai-status-failed { background:#3B1F1D !important; color:#F0A09A !important; }
  .qj-ai-status-muted { background:#1B2B22 !important; color:#9CA89F !important; }
  .qj-ai-error { color:#F0A09A !important; }
  .qj-ai-meta { color:#819287 !important; }
  .qj-tag { background:#1C3A2B !important; color:#8BAA94 !important; }
  .qj-offline { color:rgba(110,231,183,0.9) !important; }
  details.qj-category-review { color:#C9A84C !important; }
  details.qj-category-review .qj-category-review-body { background:#0E2419 !important; border-color:rgba(201,168,76,0.24) !important; color:#9CA89F !important; }
  .qj-category-review-title { color:#C9A84C !important; }
""".trimIndent()

  /** 根据文章详情构建头部 HTML，注入到 WebView 正文前 */
  fun buildArticleHeader(article: ArticleDetail, colorScheme: ReaderColorScheme, isOfflineAvailable: Boolean): String {
    val title = escapeHtml(article.displayTitle)

    val metaParts = buildList {
      article.category?.name?.takeIf { it.isNotBlank() }?.let { add("""<span class="qj-meta-source">${escapeHtml(it)}</span>""") }
      categoryReviewControl(article.categoryResult)?.let { add(it) }
      article.source?.takeIf { it.isNotBlank() }?.let { add("""<span class="qj-meta-source">${escapeHtml(it)}</span>""") }
      article.author?.takeIf { it.isNotBlank() }?.let { add("<span>${escapeHtml(it)}</span>") }
      article.publishTime?.takeIf { it.isNotBlank() }?.let { add("<span>${escapeHtml(formatDate(it))}</span>") }
        ?: article.createdAt?.takeIf { it.isNotBlank() }?.let { add("<span>${escapeHtml(formatDate(it))}</span>") }
    }
    val metaHtml = if (metaParts.isNotEmpty()) {
      """<div class="qj-meta">${metaParts.joinToString("""<span class="qj-meta-sep">·</span>""")}</div>"""
    } else ""

    val summaryHtml = aiSummaryCard(article)

    val tagsHtml = if (article.aiTags.isNotEmpty()) {
      """<div class="qj-tags">${article.aiTags.joinToString("") { """<span class="qj-tag">${escapeHtml(it)}</span>""" }}</div>"""
    } else ""

    val offlineHtml = if (isOfflineAvailable) """<div class="qj-offline">⤓ 离线可用</div>""" else ""

    val darkOverride = if (colorScheme == ReaderColorScheme.Dark) "<style>$darkHeaderOverride</style>" else ""

    return """
<div class="qj-header">
  <h1 class="qj-title">$title</h1>
  $metaHtml
  $summaryHtml
  $tagsHtml
  $offlineHtml
</div>
$darkOverride
""".trimIndent()
  }

  private fun categoryReviewControl(categoryResult: com.idickies.storing.library.ArticleCategoryResult?): String? {
    if (categoryResult?.reviewStatus != "needs_review") return null
    val reason = categoryResult.reason?.takeIf { it.isNotBlank() } ?: return null
    return """
      <details class="qj-category-review qj-category-review-trigger">
        <summary aria-label="查看 AI 分类依据">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
        </summary>
        <div class="qj-category-review-body">
          <strong class="qj-category-review-title">AI 分类依据</strong>
          <span class="qj-category-review-reason">${escapeHtml(reason)}</span>
        </div>
      </details>
    """.trimIndent()
  }

  private data class AiSummaryStatus(
    val label: String,
    val tone: String,
    val message: String? = null,
  )

  private fun aiSummaryCard(article: ArticleDetail): String {
    val summary = article.aiSummary?.trim()?.takeIf { it.isNotEmpty() }
    val status = when (article.aiStatus) {
      "queued" -> AiSummaryStatus("排队中", "pending", "正在准备摘要…")
      "running" -> AiSummaryStatus("生成中", "running", "正在生成 AI 摘要…")
      "failed" -> AiSummaryStatus("生成失败", "failed")
      "not_configured" -> AiSummaryStatus("未配置模型", "muted", "还没有配置模型，生成已跳过")
      "disabled" -> AiSummaryStatus("自动生成已关闭", "muted", "自动生成已关闭")
      else -> null
    }
    if (summary == null && status == null) return ""

    val statusBadge = status?.let {
      """<span class="qj-ai-status qj-ai-status-${it.tone}">${escapeHtml(it.label)}</span>"""
    }.orEmpty()
    val body = buildList {
      if (summary != null) add("""<p>${escapeHtml(summary)}</p>""")
      if (summary == null && status?.message != null) {
        add("""<div class="qj-ai-status-message">${escapeHtml(status.message)}</div>""")
      }
      if (article.aiStatus == "failed") {
        val detail = article.aiErrorMessage?.takeIf { it.isNotBlank() }
          ?.let { message -> article.aiErrorCode?.takeIf { it.isNotBlank() }?.let { "$it：$message" } ?: message }
          ?: article.aiErrorCode?.takeIf { it.isNotBlank() }
          ?: "生成失败"
        add("""<div class="qj-ai-error">${escapeHtml(detail)}</div>""")
      }
      val meta = buildList {
        article.aiModel?.takeIf { it.isNotBlank() }?.let { add("模型：${escapeHtml(it)}") }
        article.aiTotalTokens?.let { add("用量：$it tokens") }
      }
      if (meta.isNotEmpty()) add("""<div class="qj-ai-meta">${meta.joinToString("") { "<span>$it</span>" }}</div>""")
    }.joinToString("")

    return """
      <details class="qj-ai-card" open>
        <summary class="qj-ai-header">
          <svg class="qj-ai-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l1.9 5.8a1 1 0 0 0 .3.3L20 11l-5.8 1.9a1 1 0 0 0-.3.3L12 19l-1.9-5.8a1 1 0 0 0-.3-.3L4 11l5.8-1.9a1 1 0 0 0 .3-.3z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>
          <span class="qj-ai-label">AI 摘要</span>
          <span class="qj-ai-spacer"></span>
          $statusBadge
          <span class="qj-ai-toggle"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg></span>
        </summary>
        <div class="qj-ai-body">$body</div>
      </details>
    """.trimIndent()
  }

  private fun escapeHtml(text: String): String =
    text.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;").replace("'", "&#39;")

  private fun formatDate(iso: String): String =
    try {
      val inputFormat = java.text.SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", java.util.Locale.US)
      inputFormat.timeZone = java.util.TimeZone.getTimeZone("UTC")
      val date = inputFormat.parse(iso.take(19)) ?: return iso.take(10)
      val outputFormat = java.text.SimpleDateFormat("yyyy-MM-dd", java.util.Locale.US)
      outputFormat.timeZone = java.util.TimeZone.getDefault()
      outputFormat.format(date)
    } catch (_: Exception) {
      iso.take(10)
    }

  fun forWebView(
    capturedHtml: String,
    colorScheme: ReaderColorScheme = ReaderColorScheme.Light,
    preferences: ReaderPreferences = ReaderPreferences.Default,
    headerHtml: String = "",
  ): String {
    val mobileHead = mobileHead(colorScheme, preferences)
    val body = if (headerHtml.isNotEmpty()) "$headerHtml\n$capturedHtml" else capturedHtml
    val trimmed = body.trim()
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
