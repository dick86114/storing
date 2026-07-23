package com.idickies.storing.collect

/** Immutable, UI-ready content extracted from a system text share. */
data class ShareTargetContent(
  val urls: List<String>,
  val selectedUrl: String?,
  val message: String?,
) {
  companion object {
    fun from(text: String): ShareTargetContent {
      val urls = SharedUrlExtractor.extract(text)
      return ShareTargetContent(
        urls = urls,
        selectedUrl = urls.firstOrNull(),
        message = if (urls.isEmpty()) "未识别到可采集的网页链接" else null,
      )
    }
  }
}
