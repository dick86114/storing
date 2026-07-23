package com.idickies.storing.update

data class SettingsUpdatePresentation(
  val title: String,
  val detail: String,
  val enabled: Boolean,
)

fun settingsUpdatePresentation(checking: Boolean): SettingsUpdatePresentation = if (checking) {
  SettingsUpdatePresentation(
    title = "正在检查更新…",
    detail = "正在请求最新版本信息",
    enabled = false,
  )
} else {
  SettingsUpdatePresentation(
    title = "手动检查更新",
    detail = "立即检查 GitHub Release 中是否有新版本",
    enabled = true,
  )
}
