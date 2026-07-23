package com.idickies.storing.collect

/** Copy shown by entry points that lead to collection jobs still in progress. */
data class ActiveCollectJobsPresentation(
  val countLabel: String,
  val title: String,
  val detail: String,
)

fun activeCollectJobsPresentation(activeJobCount: Int): ActiveCollectJobsPresentation {
  require(activeJobCount > 0) { "进行中的采集任务数量必须大于 0" }
  return ActiveCollectJobsPresentation(
    countLabel = activeJobCount.toString(),
    title = "正在采集",
    detail = if (activeJobCount == 1) {
      "一条内容正在处理，完成后会自动进入收件箱"
    } else {
      "$activeJobCount 条内容正在处理，完成后会自动进入收件箱"
    },
  )
}
