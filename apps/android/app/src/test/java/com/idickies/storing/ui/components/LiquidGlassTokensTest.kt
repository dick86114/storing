package com.idickies.storing.ui.components

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class LiquidGlassTokensTest {
  @Test
  fun `light glass keeps content readable while allowing the backdrop to breathe`() {
    val panel = liquidGlassTokens(isDark = false, role = LiquidGlassRole.Panel)
    val chrome = liquidGlassTokens(isDark = false, role = LiquidGlassRole.Chrome)

    assertEquals(0.82f, panel.surfaceAlpha, 0.001f)
    assertEquals(0.72f, panel.borderAlpha, 0.001f)
    assertEquals(0.92f, panel.highlightAlpha, 0.001f)
    assertTrue(chrome.surfaceAlpha > panel.surfaceAlpha)
    assertTrue(chrome.shadowElevation > panel.shadowElevation)
  }

  @Test
  fun `dark glass uses a quieter highlight and stronger separation shadow`() {
    val panel = liquidGlassTokens(isDark = true, role = LiquidGlassRole.Panel)
    val control = liquidGlassTokens(isDark = true, role = LiquidGlassRole.Control)

    assertEquals(0.18f, panel.highlightAlpha, 0.001f)
    assertEquals(0.42f, panel.shadowAlpha, 0.001f)
    assertTrue(control.surfaceAlpha < panel.surfaceAlpha)
  }

  @Test
  fun `accent glass remains translucent instead of becoming an opaque primary button`() {
    val lightAccent = liquidGlassTokens(isDark = false, role = LiquidGlassRole.Accent)
    val darkAccent = liquidGlassTokens(isDark = true, role = LiquidGlassRole.Accent)

    assertTrue(lightAccent.surfaceAlpha < 1f)
    assertTrue(darkAccent.surfaceAlpha < 1f)
    assertTrue(lightAccent.borderAlpha > 0.5f)
  }
}
