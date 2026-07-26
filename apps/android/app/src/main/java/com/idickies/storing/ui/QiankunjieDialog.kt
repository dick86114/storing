package com.idickies.storing.ui

import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.shape.RoundedCornerShape

/** Shared modal treatment so every in-app confirmation follows the active theme. */
@Composable
fun QiankunjieAlertDialog(
  onDismissRequest: () -> Unit,
  modifier: Modifier = Modifier,
  icon: (@Composable () -> Unit)? = null,
  title: (@Composable () -> Unit)? = null,
  text: (@Composable () -> Unit)? = null,
  dismissButton: (@Composable () -> Unit)? = null,
  confirmButton: @Composable () -> Unit,
  shape: Shape = RoundedCornerShape(20.dp),
  containerColor: Color = MaterialTheme.colorScheme.surfaceVariant,
  iconContentColor: Color = MaterialTheme.colorScheme.primary,
  titleContentColor: Color = MaterialTheme.colorScheme.onSurface,
  textContentColor: Color = MaterialTheme.colorScheme.onSurfaceVariant,
  tonalElevation: Dp = 4.dp,
) {
  AlertDialog(
    onDismissRequest = onDismissRequest,
    modifier = modifier,
    icon = icon,
    title = title,
    text = text,
    dismissButton = dismissButton,
    confirmButton = confirmButton,
    shape = shape,
    containerColor = containerColor,
    iconContentColor = iconContentColor,
    titleContentColor = titleContentColor,
    textContentColor = textContentColor,
    tonalElevation = tonalElevation,
  )
}
