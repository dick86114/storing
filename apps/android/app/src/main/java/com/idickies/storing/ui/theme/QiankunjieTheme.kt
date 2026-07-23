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
  primary = Color(0xFF88C0D0),
  onPrimary = Color(0xFF2E3440),
  primaryContainer = Color(0xFF455F72),
  onPrimaryContainer = Color(0xFFE5E9F0),
  secondary = Color(0xFFA3BE8C),
  secondaryContainer = Color(0xFF46554A),
  tertiary = Color(0xFFB48EAD),
  error = Color(0xFFBF616A),
  onError = Color(0xFF2E3440),
  errorContainer = Color(0xFF593842),
  onErrorContainer = Color(0xFFF5E6E8),
  background = Color(0xFF2E3440),
  onBackground = Color(0xFFECEFF4),
  surface = Color(0xFF3B4252),
  onSurface = Color(0xFFECEFF4),
  surfaceVariant = Color(0xFF434C5E),
  onSurfaceVariant = Color(0xFFD8DEE9),
  outline = Color(0xFF81A1C1),
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

private val QiankunjieShapes = Shapes(
  small = RoundedCornerShape(10.dp),
  medium = RoundedCornerShape(18.dp),
  large = RoundedCornerShape(24.dp),
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
