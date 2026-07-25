package com.idickies.storing.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.BorderStroke
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.isSystemInDarkTheme

/** Opacity and rim values for the restrained, native liquid-glass treatment. */
data class LiquidGlassTokens(
  val surfaceAlpha: Float,
  val borderAlpha: Float,
  val highlightAlpha: Float,
)

fun liquidGlassTokens(isDark: Boolean): LiquidGlassTokens = if (isDark) {
  LiquidGlassTokens(surfaceAlpha = 0.72f, borderAlpha = 0.30f, highlightAlpha = 0.15f)
} else {
  LiquidGlassTokens(surfaceAlpha = 0.80f, borderAlpha = 0.22f, highlightAlpha = 0.12f)
}

@Composable
fun liquidGlassSurfaceColor(): Color {
  val tokens = liquidGlassTokens(isSystemInDarkTheme())
  return MaterialTheme.colorScheme.surface.copy(alpha = tokens.surfaceAlpha)
}

/** Modifier for glass chrome - enhanced transparency and border for frosted appearance. */
fun Modifier.glassBlurModifier(): Modifier = this

@Composable
private fun liquidGlassBorderColor(): Color {
  val tokens = liquidGlassTokens(isSystemInDarkTheme())
  return MaterialTheme.colorScheme.onSurface.copy(alpha = tokens.borderAlpha)
}

@Composable
private fun liquidGlassHighlightColor(): Color {
  val tokens = liquidGlassTokens(isSystemInDarkTheme())
  return MaterialTheme.colorScheme.onSurface.copy(alpha = tokens.highlightAlpha)
}

/**
 * A deliberately restrained glass layer for chrome and transient controls.
 * It does not attempt a costly or platform-inconsistent backdrop blur.
 */
@Composable
fun QiankunjieGlassPanel(
  modifier: Modifier = Modifier,
  shape: Shape = MaterialTheme.shapes.large,
  content: @Composable () -> Unit,
) {
  val surfaceColor = liquidGlassSurfaceColor()
  val borderColor = liquidGlassBorderColor()
  val highlightColor = liquidGlassHighlightColor()
  Surface(
    modifier = modifier,
    shape = shape,
    color = surfaceColor,
    contentColor = MaterialTheme.colorScheme.onSurface,
    border = BorderStroke(1.dp, borderColor),
    tonalElevation = 0.dp,
    shadowElevation = 8.dp,
  ) {
    Box(modifier = Modifier.fillMaxWidth().clip(shape)) {
      Box(
        modifier = Modifier
          .matchParentSize()
          .background(Brush.verticalGradient(listOf(highlightColor, Color.Transparent))),
      )
      content()
    }
  }
}
