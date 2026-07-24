package com.idickies.storing.library

enum class ArticleProcessingAction(
  val label: String,
  val confirmationTitle: String,
  val confirmationLead: String,
  val confirmationMessage: String,
) {
  Refetch(
    label = "重新抓取",
    confirmationTitle = "重新抓取文章？",
    confirmationLead = "重新抓取会覆盖",
    confirmationMessage = "重新抓取会覆盖当前已保存的正文和封面图；收藏、归档、发布状态不会改变。",
  ),
  RegenerateAi(
    label = "重新生成 AI",
    confirmationTitle = "重新生成 AI 摘要？",
    confirmationLead = "不会重新抓取原文",
    confirmationMessage = "不会重新抓取原文，将基于当前保存的正文重新生成摘要、分类和标签。",
  ),
}
