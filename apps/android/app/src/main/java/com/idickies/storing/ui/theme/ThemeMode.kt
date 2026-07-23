package com.idickies.storing.ui.theme

/** User-facing appearance preference. System is the default and persists across restarts. */
enum class ThemeMode(val label: String) {
  System("跟随系统"),
  Light("浅色模式"),
  Dark("深色模式");

  fun resolve(systemDark: Boolean): Boolean = when (this) {
    System -> systemDark
    Light -> false
    Dark -> true
  }
}
