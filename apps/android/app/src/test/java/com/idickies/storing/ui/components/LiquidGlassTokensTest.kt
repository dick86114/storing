package com.idickies.storing.ui.components

import org.junit.Assert.assertEquals
import org.junit.Test

class LiquidGlassTokensTest {
  @Test
  fun `light card chrome is opaque with a restrained border token`() {
    assertEquals(
      LiquidGlassTokens(
        surfaceAlpha = 1f,
        borderAlpha = 0.4f,
        highlightAlpha = 0f,
      ),
      liquidGlassTokens(isDark = false),
    )
  }

  @Test
  fun `dark card chrome uses the same opaque book-theme tokens`() {
    assertEquals(
      LiquidGlassTokens(
        surfaceAlpha = 1f,
        borderAlpha = 0.4f,
        highlightAlpha = 0f,
      ),
      liquidGlassTokens(isDark = true),
    )
  }
}
