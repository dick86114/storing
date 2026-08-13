package com.idickies.storing.uilab

enum class UiLabScenario(
  val route: String,
  val title: String,
) {
  Login("login", "登录"),
  Library("library", "资料库"),
  Search("search", "搜索"),
  Empty("empty", "空状态"),
  Reader("reader", "阅读器"),
  Poster("poster", "分享海报"),
  Share("share", "分享采集"),
  Tasks("tasks", "采集任务"),
  States("states", "状态反馈"),
  Settings("settings", "设置");

  companion object {
    fun fromRoute(route: String?): UiLabScenario = entries.firstOrNull { it.route == route } ?: Library
  }
}
