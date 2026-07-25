package com.idickies.storing.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
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

/* 对齐设计稿：底部导航 4 栏均分，激活态金色文字 + 小圆点指示器 */

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

@Composable
fun QiankunjieCompactBottomBar(
  modifier: Modifier = Modifier,
  content: @Composable () -> Unit,
) {
  Row(
    modifier = modifier
      .fillMaxWidth()
      .windowInsetsPadding(WindowInsets.navigationBars)
      .padding(horizontal = 4.dp, vertical = compactBottomBarMetrics.verticalInset)
      .height(compactBottomBarMetrics.actionHeight),
    horizontalArrangement = Arrangement.SpaceEvenly,
    verticalAlignment = Alignment.CenterVertically,
  ) {
    content()
  }
}

@Composable
fun CompactBottomBarItem(
  label: String,
  icon: ImageVector,
  selected: Boolean,
  enabled: Boolean = true,
  badgeCount: Int? = null,
  onClick: () -> Unit,
) {
  val contentColor = when {
    !enabled -> MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.38f)
    selected -> MaterialTheme.colorScheme.primary
    else -> MaterialTheme.colorScheme.onSurfaceVariant
  }
  Column(
    modifier = Modifier
      .semantics { stateDescription = if (selected) "$label，已选中" else label }
      .clickable(enabled = enabled, role = Role.Tab, onClick = onClick)
      .padding(horizontal = 8.dp),
    horizontalAlignment = Alignment.CenterHorizontally,
    verticalArrangement = Arrangement.spacedBy(2.dp),
  ) {
    Box(contentAlignment = Alignment.TopEnd) {
      Icon(
        imageVector = icon,
        contentDescription = label,
        modifier = Modifier.size(22.dp),
        tint = contentColor,
      )
      if (badgeCount != null && badgeCount > 0) {
        Surface(
          color = MaterialTheme.colorScheme.primary,
          contentColor = MaterialTheme.colorScheme.onPrimary,
          shape = RoundedCornerShape(10.dp),
          modifier = Modifier.size(width = 16.dp, height = 14.dp),
        ) {
          Text(
            if (badgeCount > 99) "99+" else badgeCount.toString(),
            style = MaterialTheme.typography.labelSmall,
            modifier = Modifier.wrapContentSize(Alignment.Center),
          )
        }
      }
    }
    Text(
      label,
      style = MaterialTheme.typography.labelMedium,
      color = contentColor,
    )
    // 激活态指示小圆点，对齐设计稿 indicator dot
    Spacer(Modifier.size(2.dp))
    Box(
      modifier = Modifier
        .size(if (selected) 4.dp else 0.dp)
        .background(
          if (selected) MaterialTheme.colorScheme.primary else Color.Transparent,
          CircleShape,
        ),
    )
  }
}
