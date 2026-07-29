package com.idickies.storing.ui.theme

import androidx.compose.ui.graphics.Color
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class QiankunjieThemeAppearanceTest {
  @Test
  fun `appearance detection follows the applied color scheme instead of the system preference`() {
    assertTrue(isQiankunjieDarkBackground(Color(0xFF071A12)))
    assertFalse(isQiankunjieDarkBackground(Color(0xFFF3F7F3)))
  }
}

class SystemBarAppearanceTest {
  @Test
  fun `dark application theme requests light system bar icons regardless of system mode`() {
    assertFalse(systemBarsUseDarkIcons(appDarkTheme = true))
    assertTrue(systemBarsUseDarkIcons(appDarkTheme = false))
  }
}
