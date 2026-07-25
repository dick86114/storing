package com.idickies.storing.ui.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.layout.Box
import androidx.compose.material3.Badge
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
import androidx.compose.foundation.shape.RoundedCornerShape
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
      .windowInsetsPadding(WindowInsets.navigationBars)
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
  badgeCount: Int? = null,
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
    Row(
      modifier = Modifier.padding(horizontal = 6.dp),
      horizontalArrangement = Arrangement.Center,
      verticalAlignment = Alignment.CenterVertically,
    ) {
      Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
      ) {
        Icon(imageVector = icon, contentDescription = label, modifier = Modifier.height(22.dp))
        Text(label, style = MaterialTheme.typography.labelMedium, modifier = Modifier.padding(top = 2.dp))
      }
      if (badgeCount != null && badgeCount > 0) {
        Surface(
          color = MaterialTheme.colorScheme.primary,
          contentColor = MaterialTheme.colorScheme.onPrimary,
          shape = androidx.compose.foundation.shape.RoundedCornerShape(10.dp),
          modifier = Modifier.padding(start = 4.dp).size(width = 20.dp, height = 16.dp),
        ) {
          Text(
            if (badgeCount > 99) "99+" else badgeCount.toString(),
            style = MaterialTheme.typography.labelSmall,
            modifier = Modifier.wrapContentSize(Alignment.Center),
          )
        }
      }
    }
  }
}
