package com.idickies.storing.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/* 乾坤戒「澄明书斋」双色方案 —— 暖珍珠玻璃 × 深墨玻璃 */

// ── 浅色：暖珍珠金 ─────────────────────────────
private val LightColors = lightColorScheme(
  primary = Color(0xFFB28724),
  onPrimary = Color(0xFFFFFFFF),
  primaryContainer = Color(0xFFFFF1C8),
  onPrimaryContainer = Color(0xFF3D2A00),
  secondary = Color(0xFF0D2B1E),
  onSecondary = Color(0xFFFFFFFF),
  secondaryContainer = Color(0xFFDCEDE3),
  onSecondaryContainer = Color(0xFF001A10),
  tertiary = Color(0xFF60786B),
  tertiaryContainer = Color(0xFFE5EFE9),
  onTertiaryContainer = Color(0xFF17261C),
  error = Color(0xFFD93025),
  onError = Color(0xFFFFFFFF),
  errorContainer = Color(0xFFFFDAD6),
  onErrorContainer = Color(0xFF410002),
  background = Color(0xFFF3F7F3),
  onBackground = Color(0xFF1A2E24),
  surface = Color(0xFFFFFFFF),
  onSurface = Color(0xFF1A2E24),
  surfaceVariant = Color(0xFFEAF0EB),
  onSurfaceVariant = Color(0xFF5A7062),
  outline = Color(0xFFD5DED7),
  outlineVariant = Color(0xFFE5ECE7),
)

// ── 深色：深墨玻璃 ─────────────────────────────
private val DarkColors = darkColorScheme(
  primary = Color(0xFFC9A84C),
  onPrimary = Color(0xFF071A12),
  primaryContainer = Color(0xFF463A20),
  onPrimaryContainer = Color(0xFFFFE9A0),
  secondary = Color(0xFF8BAA94),
  onSecondary = Color(0xFF071A12),
  secondaryContainer = Color(0xFF1C3A2B),
  onSecondaryContainer = Color(0xFFC8E6D0),
  tertiary = Color(0xFF9CA89F),
  tertiaryContainer = Color(0xFF2A3A30),
  onTertiaryContainer = Color(0xFFB8CCBD),
  error = Color(0xFFE74C3C),
  onError = Color(0xFF071A12),
  errorContainer = Color(0xFF4A2A28),
  onErrorContainer = Color(0xFFFFDAD6),
  background = Color(0xFF071A12),
  onBackground = Color(0xFFE8E4DC),
  surface = Color(0xFF10271D),
  onSurface = Color(0xFFE8E4DC),
  surfaceVariant = Color(0xFF173126),
  onSurfaceVariant = Color(0xFF9CA89F),
  outline = Color(0xFF315043),
  outlineVariant = Color(0xFF29473A),
)

private val QiankunjieTypography = Typography(
  headlineMedium = TextStyle(fontSize = 27.sp, lineHeight = 35.sp, fontWeight = FontWeight.SemiBold),
  headlineSmall = TextStyle(fontSize = 22.sp, lineHeight = 29.sp, fontWeight = FontWeight.SemiBold),
  titleLarge = TextStyle(fontSize = 18.sp, lineHeight = 25.sp, fontWeight = FontWeight.SemiBold),
  titleMedium = TextStyle(fontSize = 16.sp, lineHeight = 22.sp, fontWeight = FontWeight.SemiBold),
  bodyLarge = TextStyle(fontSize = 16.sp, lineHeight = 27.sp),
  bodyMedium = TextStyle(fontSize = 14.sp, lineHeight = 21.sp),
  labelLarge = TextStyle(fontSize = 13.sp, lineHeight = 18.sp, fontWeight = FontWeight.SemiBold),
  labelMedium = TextStyle(fontSize = 11.sp, lineHeight = 16.sp, fontWeight = FontWeight.Medium),
)

/* 圆角对齐设计稿：标签 pill → small，卡片 → medium，设置分组 → large */
private val QiankunjieShapes = Shapes(
  small = RoundedCornerShape(8.dp),
  medium = RoundedCornerShape(12.dp),
  large = RoundedCornerShape(16.dp),
)

@Composable
fun QiankunjieTheme(
  darkTheme: Boolean = isSystemInDarkTheme(),
  content: @Composable () -> Unit,
) {
  MaterialTheme(
    colorScheme = if (darkTheme) DarkColors else LightColors,
    typography = QiankunjieTypography,
    shapes = QiankunjieShapes,
    content = content,
  )
}
