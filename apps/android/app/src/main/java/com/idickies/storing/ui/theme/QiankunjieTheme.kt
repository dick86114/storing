package com.idickies.storing.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.ui.graphics.Color

private val LightColors = lightColorScheme(
  primary = Color(0xFFB5463D),
  onPrimary = Color.White,
  secondary = Color(0xFFD6863D),
  background = Color(0xFFFAF8F5),
  surface = Color(0xFFFFFBFF),
)

private val DarkColors = darkColorScheme(
  primary = Color(0xFFFFB4AB),
  secondary = Color(0xFFFFB870),
  background = Color(0xFF171211),
  surface = Color(0xFF211A19),
)

@Composable
fun QiankunjieTheme(
  darkTheme: Boolean = isSystemInDarkTheme(),
  content: @Composable () -> Unit,
) {
  MaterialTheme(
    colorScheme = if (darkTheme) DarkColors else LightColors,
    content = content,
  )
}
