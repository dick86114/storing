package com.idickies.storing.ui.components

import org.junit.Assert.assertEquals
import org.junit.Test

class LiquidGlassTokensTest {
  @Test
  fun `light glass is mostly opaque with a clear hairline border`() {
    assertEquals(
      LiquidGlassTokens(
        surfaceAlpha = 0.80f,
        borderAlpha = 0.22f,
        highlightAlpha = 0.12f,
      ),
      liquidGlassTokens(isDark = false),
    )
  }

  @Test
  fun `nord dark glass remains cool and sufficiently solid for readable controls`() {
    assertEquals(
      LiquidGlassTokens(
        surfaceAlpha = 0.72f,
        borderAlpha = 0.30f,
        highlightAlpha = 0.15f,
      ),
      liquidGlassTokens(isDark = true),
    )
  }
}
