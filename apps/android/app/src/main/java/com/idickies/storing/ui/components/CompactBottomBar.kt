package com.idickies.storing.ui.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.unit.dp

data class CompactBottomBarMetrics(
  val actionHeight: androidx.compose.ui.unit.Dp,
  val verticalInset: androidx.compose.ui.unit.Dp,
) {
  val totalHeight: androidx.compose.ui.unit.Dp get() = actionHeight + (verticalInset * 2)
}

val compactBottomBarMetrics = CompactBottomBarMetrics(
  actionHeight = 56.dp,
  verticalInset = 0.dp,
)

/** A compact glass shell that keeps bottom actions precise instead of Material's 80dp navigation default. */
@Composable
fun QiankunjieCompactBottomBar(
  modifier: Modifier = Modifier,
  content: @Composable () -> Unit,
) {
  Row(
    modifier = modifier
      .fillMaxWidth()
      .padding(horizontal = 12.dp, vertical = compactBottomBarMetrics.verticalInset)
      .height(compactBottomBarMetrics.actionHeight),
    horizontalArrangement = Arrangement.SpaceEvenly,
    verticalAlignment = Alignment.CenterVertically,
  ) {
    content()
  }
}

/** One 56dp touch target inside the compact bottom bar. */
@Composable
fun CompactBottomBarItem(
  label: String,
  icon: ImageVector,
  selected: Boolean,
  enabled: Boolean = true,
  onClick: () -> Unit,
) {
  val selectedContainer = MaterialTheme.colorScheme.primaryContainer.copy(alpha = 0.58f)
  val contentColor = if (selected) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant
  Surface(
    modifier = Modifier
      .width(84.dp)
      .height(compactBottomBarMetrics.actionHeight)
      .semantics { stateDescription = if (selected) "$label，已选中" else label }
      .clickable(enabled = enabled, role = Role.Tab, onClick = onClick),
    color = if (selected) selectedContainer else Color.Transparent,
    contentColor = if (enabled) contentColor else contentColor.copy(alpha = 0.38f),
    shape = MaterialTheme.shapes.medium,
  ) {
    Column(
      horizontalAlignment = Alignment.CenterHorizontally,
      verticalArrangement = Arrangement.Center,
    ) {
      Icon(imageVector = icon, contentDescription = label, modifier = Modifier.height(22.dp))
      Text(label, style = MaterialTheme.typography.labelMedium, modifier = Modifier.padding(top = 2.dp))
    }
  }
}
