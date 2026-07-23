package com.idickies.storing.ui.components

import org.junit.Assert.assertEquals
import org.junit.Test

class LiquidGlassTokensTest {
  @Test
  fun `light glass is mostly opaque with a clear hairline border`() {
    assertEquals(
      LiquidGlassTokens(
        surfaceAlpha = 0.88f,
        borderAlpha = 0.18f,
        highlightAlpha = 0.10f,
      ),
      liquidGlassTokens(isDark = false),
    )
  }

  @Test
  fun `nord dark glass remains cool and sufficiently solid for readable controls`() {
    assertEquals(
      LiquidGlassTokens(
        surfaceAlpha = 0.82f,
        borderAlpha = 0.24f,
        highlightAlpha = 0.12f,
      ),
      liquidGlassTokens(isDark = true),
    )
  }
}
