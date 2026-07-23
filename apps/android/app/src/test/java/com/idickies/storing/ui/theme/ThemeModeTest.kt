package com.idickies.storing.ui.theme

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ThemeModeTest {
  @Test
  fun `appearance preference resolves light dark and system modes deterministically`() {
    assertFalse(ThemeMode.Light.resolve(systemDark = true))
    assertTrue(ThemeMode.Dark.resolve(systemDark = false))
    assertTrue(ThemeMode.System.resolve(systemDark = true))
    assertFalse(ThemeMode.System.resolve(systemDark = false))
  }
}
