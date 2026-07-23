package com.idickies.storing.settings

data class BatteryOptimizationGuidanceContent(
  val title: String,
  val steps: List<String>,
)

object BatteryOptimizationGuidance {
  fun forManufacturer(manufacturer: String?): BatteryOptimizationGuidanceContent {
    val isXiaomi = manufacturer.orEmpty().contains("xiaomi", ignoreCase = true) ||
      manufacturer.orEmpty().contains("redmi", ignoreCase = true)
    return if (isXiaomi) {
      BatteryOptimizationGuidanceContent(
        title = "小米 / 澎湃 OS 后台说明",
        steps = listOf(
          "乾坤戒不会使用常驻前台服务；采集完成通知可能受系统省电策略影响。",
          "如遇到锁屏后通知延迟，可在澎湃 OS 的应用耗电管理中，将乾坤戒设为“不限制”。",
          "如仍有延迟，可在应用详情中允许后台活动；不需要也不建议强制开启自启动。",
          "即使通知延迟，采集任务仍会在服务器继续执行；重新打开乾坤戒可在“任务”中查看结果。",
        ),
      )
    } else {
      BatteryOptimizationGuidanceContent(
        title = "后台采集与通知说明",
        steps = listOf(
          "乾坤戒使用系统 WorkManager 跟踪采集任务，不使用常驻前台服务。",
          "若系统省电策略导致通知延迟，可将乾坤戒设为“不限制”或允许后台活动。",
          "即使通知延迟，采集任务仍会在服务器继续执行；重新打开乾坤戒可在“任务”中查看结果。",
        ),
      )
    }
  }
}
