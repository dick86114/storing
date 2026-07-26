package com.idickies.storing.ui.components

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.wrapContentSize
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.semantics.Role
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.semantics.stateDescription
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

/* 底部导航：圆角承托式导航栏，较大的图标、紧凑标签和清晰 badge。 */

data class CompactBottomBarMetrics(
  val actionHeight: androidx.compose.ui.unit.Dp,
  val verticalInset: androidx.compose.ui.unit.Dp,
) {
  val totalHeight: androidx.compose.ui.unit.Dp get() = actionHeight + (verticalInset * 2)
}

val compactBottomBarMetrics = CompactBottomBarMetrics(
  actionHeight = 68.dp,
  verticalInset = 0.dp,
)

@Composable
private fun navSelectedColor(): Color = MaterialTheme.colorScheme.primary

@Composable
fun QiankunjieCompactBottomBar(
  modifier: Modifier = Modifier,
  content: @Composable () -> Unit,
) {
  Surface(
    modifier = modifier.fillMaxWidth(),
    shape = RoundedCornerShape(topStart = 30.dp, topEnd = 30.dp),
    color = MaterialTheme.colorScheme.surfaceVariant,
    contentColor = MaterialTheme.colorScheme.onSurface,
    border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.56f)),
    tonalElevation = 0.dp,
    shadowElevation = 10.dp,
  ) {
    Column {
      HorizontalDivider(thickness = 0.5.dp, color = MaterialTheme.colorScheme.outline.copy(alpha = 0.42f))
      Row(
        modifier = Modifier
          .fillMaxWidth()
          .windowInsetsPadding(WindowInsets.navigationBars)
          .padding(horizontal = 12.dp)
          .height(compactBottomBarMetrics.actionHeight),
        horizontalArrangement = Arrangement.SpaceEvenly,
        verticalAlignment = Alignment.CenterVertically,
      ) {
        content()
      }
    }
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
  val selectedColor = navSelectedColor()
  val contentColor = when {
    !enabled -> MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.38f)
    selected -> selectedColor
    else -> MaterialTheme.colorScheme.onSurfaceVariant
  }
  Column(
    modifier = Modifier
      .semantics { stateDescription = if (selected) "$label，已选中" else label }
      .clickable(
        interactionSource = remember { MutableInteractionSource() },
        indication = null,
        enabled = enabled,
        role = Role.Tab,
        onClick = onClick,
      )
      .padding(horizontal = 10.dp, vertical = 6.dp),
    horizontalAlignment = Alignment.CenterHorizontally,
    verticalArrangement = Arrangement.spacedBy(4.dp),
  ) {
    // Icon + Badge
    Box(contentAlignment = Alignment.TopEnd) {
      Icon(
        imageVector = icon,
        contentDescription = label,
        modifier = Modifier.size(25.dp),
        tint = contentColor,
      )
      if (badgeCount != null && badgeCount > 0) {
        val transition = rememberInfiniteTransition(label = "badge")
        val pulseAlpha by transition.animateFloat(
          initialValue = 1f,
          targetValue = 0.4f,
          animationSpec = infiniteRepeatable(tween(1200), RepeatMode.Reverse),
          label = "badgePulse",
        )
        Surface(
          color = MaterialTheme.colorScheme.primary,
          contentColor = MaterialTheme.colorScheme.onPrimary,
          shape = CircleShape,
          modifier = Modifier
            .offset(x = 7.dp, y = (-5).dp)
            .size(18.dp)
            .alpha(pulseAlpha),
        ) {
          Text(
            if (badgeCount > 99) "99+" else badgeCount.toString(),
            fontSize = 10.sp,
            fontWeight = androidx.compose.ui.text.font.FontWeight.Bold,
            modifier = Modifier.wrapContentSize(Alignment.Center),
          )
        }
      }
    }
    // Label
    Text(
      label,
      fontSize = 12.sp,
      fontWeight = if (selected) androidx.compose.ui.text.font.FontWeight.SemiBold else androidx.compose.ui.text.font.FontWeight.Normal,
      color = contentColor,
    )
  }
}
