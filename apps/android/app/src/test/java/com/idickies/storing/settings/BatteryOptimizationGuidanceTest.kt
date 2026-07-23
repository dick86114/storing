package com.idickies.storing.settings

import org.junit.Assert.assertTrue
import org.junit.Test

class BatteryOptimizationGuidanceTest {
  @Test
  fun `xiaomi guidance mentions HyperOS battery controls without requesting forced auto start`() {
    val guidance = BatteryOptimizationGuidance.forManufacturer("Xiaomi")
    assertTrue(guidance.title.contains("小米"))
    assertTrue(guidance.steps.any { it.contains("澎湃") })
    assertTrue(guidance.steps.none { it.contains("必须开启自启动") })
  }
}
