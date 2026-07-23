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

private val LightColors = lightColorScheme(
  primary = Color(0xFFAA3E35),
  onPrimary = Color(0xFFFFFFFF),
  primaryContainer = Color(0xFFFFDAD4),
  onPrimaryContainer = Color(0xFF3E0503),
  error = Color(0xFFBA1A1A),
  onError = Color(0xFFFFFFFF),
  errorContainer = Color(0xFFFFDAD6),
  onErrorContainer = Color(0xFF410002),
  secondary = Color(0xFF856327),
  secondaryContainer = Color(0xFFFFDEA1),
  background = Color(0xFFF7F5F0),
  onBackground = Color(0xFF1D1B19),
  surface = Color(0xFFFFFCF8),
  onSurface = Color(0xFF1D1B19),
  surfaceVariant = Color(0xFFECE5DD),
  onSurfaceVariant = Color(0xFF554B47),
  outline = Color(0xFFD2C5BC),
)

private val DarkColors = darkColorScheme(
  primary = Color(0xFFFFB4A9),
  onPrimary = Color(0xFF651812),
  primaryContainer = Color(0xFF5C2C28),
  onPrimaryContainer = Color(0xFFFFDAD4),
  error = Color(0xFFFFB4AB),
  onError = Color(0xFF690005),
  errorContainer = Color(0xFF5E2927),
  onErrorContainer = Color(0xFFFFDAD6),
  secondary = Color(0xFFE8C483),
  background = Color(0xFF171412),
  onBackground = Color(0xFFEAE1DC),
  surface = Color(0xFF201C19),
  onSurface = Color(0xFFEAE1DC),
  surfaceVariant = Color(0xFF49413D),
  onSurfaceVariant = Color(0xFFD5C4BD),
  outline = Color(0xFF9D8D86),
)

private val QiankunjieTypography = Typography(
  headlineMedium = TextStyle(fontSize = 30.sp, lineHeight = 38.sp, fontWeight = FontWeight.SemiBold),
  headlineSmall = TextStyle(fontSize = 24.sp, lineHeight = 31.sp, fontWeight = FontWeight.SemiBold),
  titleLarge = TextStyle(fontSize = 20.sp, lineHeight = 28.sp, fontWeight = FontWeight.SemiBold),
  titleMedium = TextStyle(fontSize = 17.sp, lineHeight = 24.sp, fontWeight = FontWeight.SemiBold),
  bodyLarge = TextStyle(fontSize = 17.sp, lineHeight = 29.sp),
  bodyMedium = TextStyle(fontSize = 15.sp, lineHeight = 22.sp),
  labelLarge = TextStyle(fontSize = 14.sp, lineHeight = 20.sp, fontWeight = FontWeight.SemiBold),
  labelMedium = TextStyle(fontSize = 12.sp, lineHeight = 17.sp, fontWeight = FontWeight.Medium),
)

private val QiankunjieShapes = Shapes(
  small = RoundedCornerShape(12.dp),
  medium = RoundedCornerShape(20.dp),
  large = RoundedCornerShape(28.dp),
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
