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
  ReclassifyCategory(
    label = "重新判断分类",
    confirmationTitle = "重新判断文章分类？",
    confirmationLead = "不会重新生成摘要或标签",
    confirmationMessage = "将仅根据现有预设分类重新判断这篇文章的主分类；人工确认过的分类不会被覆盖。",
  ),
  UpdateTitle(
    label = "修改标题",
    confirmationTitle = "修改文章标题？",
    confirmationLead = "新标题会同步到所有端",
    confirmationMessage = "标题修改后会立即在所有设备上同步显示；文章内容不受影响。",
  ),
}
