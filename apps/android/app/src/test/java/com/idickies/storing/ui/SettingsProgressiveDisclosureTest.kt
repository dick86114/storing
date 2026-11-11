package com.idickies.storing.ui

import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class SettingsProgressiveDisclosureTest {
  private val root = generateSequence(File(System.getProperty("user.dir"))) { it.parentFile }
    .first { File(it, "apps/android").exists() }!!

  private fun read(path: String) = File(root, path).readText()

  @Test
  fun `settings uses disclosure sections and keeps cache policy available`() {
    val settings = read("apps/android/app/src/main/java/com/idickies/storing/ui/SettingsScreen.kt")
    val library = read("apps/android/app/src/main/java/com/idickies/storing/ui/LibraryScreen.kt")

    assertTrue(settings.contains("SettingsDisclosureSection"))
    assertTrue(settings.contains("AUTOMATIC_CACHE_MAX_BYTES"))
    assertTrue(settings.contains("AUTOMATIC_CACHE_MAX_AGE_DAYS"))
    assertTrue(settings.contains("优先淘汰最久未访问"))
    assertTrue(settings.contains("AUTOMATIC_IMAGE_MAX_COUNT"))
    assertTrue(library.contains("expandedSettingsSections"))
  }
}
