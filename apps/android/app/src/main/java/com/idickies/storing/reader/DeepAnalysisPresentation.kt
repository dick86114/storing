package com.idickies.storing.reader

object DeepAnalysisPresentation {
  val RUNNING = "running"
  val DONE = "done"
  val FAILED = "failed"
  const val offlineSubmitAllowed = false

  fun of(status: String?): String = when (status) {
    "queued", "running" -> RUNNING
    "succeeded" -> DONE
    "failed" -> FAILED
    else -> "idle"
  }
}

object DeepAnalysisSheetSections {
  val all = listOf(
    "一段看懂",
    "核心论点",
    "论证链路",
    "关键信息与数据",
    "不同观点",
    "风险与局限",
    "行动指引",
    "延伸问题",
    "阅读路径",
  )
}
