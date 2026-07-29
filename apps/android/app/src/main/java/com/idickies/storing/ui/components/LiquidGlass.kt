package com.idickies.storing.ui.components

import com.idickies.storing.ui.theme.isQiankunjieDarkTheme

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxScope
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/**
 * 分层玻璃角色。信息卡片保持克制，导航等 chrome 更清晰，控件更轻，主操作保留强调色。
 */
enum class LiquidGlassRole { Panel, Chrome, Control, Accent }

data class LiquidGlassTokens(
  val surfaceAlpha: Float,
  val borderAlpha: Float,
  val highlightAlpha: Float,
  val shadowAlpha: Float,
  val shadowElevation: Dp,
)

fun liquidGlassTokens(
  isDark: Boolean,
  role: LiquidGlassRole = LiquidGlassRole.Panel,
): LiquidGlassTokens = when (isDark) {
  false -> when (role) {
    LiquidGlassRole.Panel -> LiquidGlassTokens(0.82f, 0.72f, 0.92f, 0.12f, 0.dp)
    LiquidGlassRole.Chrome -> LiquidGlassTokens(0.88f, 0.80f, 0.96f, 0.16f, 16.dp)
    LiquidGlassRole.Control -> LiquidGlassTokens(0.68f, 0.74f, 0.92f, 0.10f, 4.dp)
    LiquidGlassRole.Accent -> LiquidGlassTokens(0.84f, 0.66f, 0.96f, 0.18f, 12.dp)
  }
  true -> LiquidGlassTokens(1f, 0.4f, 0f, 0f, 0.dp)
}

@Composable
fun liquidGlassSurfaceColor(role: LiquidGlassRole = LiquidGlassRole.Chrome): Color {
  val isDark = isQiankunjieDarkTheme()
  if (isDark) return MaterialTheme.colorScheme.surfaceVariant
  val tokens = liquidGlassTokens(isDark, role)
  return MaterialTheme.colorScheme.surface.copy(alpha = tokens.surfaceAlpha)
}

@Composable
fun liquidGlassBackdropBrush(): Brush {
  val colors = MaterialTheme.colorScheme
  val isDark = isQiankunjieDarkTheme()
  return if (isDark) {
    SolidColor(colors.background)
  } else {
    Brush.verticalGradient(
      listOf(
        Color(0xFFF8FBF8),
        Color(0xFFF2F6F2),
        Color(0xFFF7F4EC),
      ),
    )
  }
}

/**
 * 用透明渐变、亮边和环境投影模拟背景折射；不引入昂贵的实时全屏模糊。
 */
@Composable
fun Modifier.liquidGlass(
  shape: Shape,
  role: LiquidGlassRole = LiquidGlassRole.Panel,
  tint: Color = Color.Unspecified,
  shadowElevation: Dp? = null,
): Modifier {
  val isDark = isQiankunjieDarkTheme()
  val tokens = liquidGlassTokens(isDark, role)
  val colors = MaterialTheme.colorScheme
  val base = if (tint == Color.Unspecified) colors.surface else tint
  val topAlpha = (tokens.surfaceAlpha + if (isDark) 0.04f else 0.10f).coerceAtMost(1f)
  val bottomAlpha = (tokens.surfaceAlpha - if (isDark) 0.04f else 0.07f).coerceAtLeast(0f)
  val borderColor = if (isDark) {
    colors.outline.copy(alpha = tokens.borderAlpha)
  } else {
    Color.White.copy(alpha = tokens.borderAlpha)
  }
  val shadowColor = if (isDark) Color.Black else Color(0xFF173B2B)

  val elevation = shadowElevation ?: tokens.shadowElevation
  val decorated = if (elevation > 0.dp) {
    this.shadow(
      elevation = elevation,
      shape = shape,
      clip = false,
      ambientColor = shadowColor.copy(alpha = tokens.shadowAlpha * 0.66f),
      spotColor = shadowColor.copy(alpha = tokens.shadowAlpha),
    )
  } else {
    this
  }

  return decorated
    .clip(shape)
    .background(
      brush = Brush.verticalGradient(
        colors = listOf(
          base.copy(alpha = topAlpha),
          base.copy(alpha = tokens.surfaceAlpha),
          base.copy(alpha = bottomAlpha),
        ),
      ),
      shape = shape,
    )
    .border(BorderStroke(0.8.dp, borderColor), shape)
}

/** 遗留兼容：当前使用轻量材质模拟，不做实时背景模糊。 */
fun Modifier.glassBlurModifier(): Modifier = this

@Composable
fun QiankunjieGlassPanel(
  modifier: Modifier = Modifier,
  shape: Shape = MaterialTheme.shapes.large,
  role: LiquidGlassRole = LiquidGlassRole.Panel,
  tint: Color = Color.Unspecified,
  content: @Composable BoxScope.() -> Unit,
) {
  if (isQiankunjieDarkTheme()) {
    Surface(
      modifier = modifier,
      shape = shape,
      color = MaterialTheme.colorScheme.surface,
      contentColor = MaterialTheme.colorScheme.onSurface,
      border = BorderStroke(0.5.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.4f)),
      tonalElevation = 0.dp,
      shadowElevation = 2.dp,
    ) {
      Box(content = content)
    }
  } else {
    Surface(
      modifier = modifier.liquidGlass(shape = shape, role = role, tint = tint),
      shape = shape,
      color = Color.Transparent,
      contentColor = MaterialTheme.colorScheme.onSurface,
      tonalElevation = 0.dp,
      shadowElevation = 0.dp,
    ) {
      Box(content = content)
    }
  }
}
