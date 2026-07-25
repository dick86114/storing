package com.idickies.storing.ui.components

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.BorderStroke
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.unit.dp

/* 适配新「古卷书斋」色板：去除玻璃质感，改为纯色卡片 */

data class LiquidGlassTokens(
  val surfaceAlpha: Float,
  val borderAlpha: Float,
  val highlightAlpha: Float,
)

fun liquidGlassTokens(isDark: Boolean): LiquidGlassTokens = LiquidGlassTokens(
  surfaceAlpha = 1f,
  borderAlpha = 0.4f,
  highlightAlpha = 0f,
)

@Composable
fun liquidGlassSurfaceColor(): Color = MaterialTheme.colorScheme.surfaceVariant

/** 遗留兼容：不做模糊处理 */
fun Modifier.glassBlurModifier(): Modifier = this

@Composable
fun QiankunjieGlassPanel(
  modifier: Modifier = Modifier,
  shape: Shape = MaterialTheme.shapes.large,
  content: @Composable () -> Unit,
) {
  Surface(
    modifier = modifier,
    shape = shape,
    color = MaterialTheme.colorScheme.surface,
    contentColor = MaterialTheme.colorScheme.onSurface,
    border = BorderStroke(0.5.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.4f)),
    tonalElevation = 0.dp,
    shadowElevation = 2.dp,
    content = content,
  )
}
