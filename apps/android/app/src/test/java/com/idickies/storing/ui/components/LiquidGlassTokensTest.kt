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
  fun `dark mode keeps the previous opaque material treatment across roles`() {
    LiquidGlassRole.entries.forEach { role ->
      val tokens = liquidGlassTokens(isDark = true, role = role)

      assertEquals(1f, tokens.surfaceAlpha, 0.001f)
      assertEquals(0.4f, tokens.borderAlpha, 0.001f)
      assertEquals(0f, tokens.highlightAlpha, 0.001f)
      assertEquals(0f, tokens.shadowAlpha, 0.001f)
    }
  }

  @Test
  fun `accent glass stays translucent only in the light appearance`() {
    val lightAccent = liquidGlassTokens(isDark = false, role = LiquidGlassRole.Accent)
    val darkAccent = liquidGlassTokens(isDark = true, role = LiquidGlassRole.Accent)

    assertTrue(lightAccent.surfaceAlpha < 1f)
    assertEquals(1f, darkAccent.surfaceAlpha, 0.001f)
    assertTrue(lightAccent.borderAlpha > 0.5f)
  }
}
