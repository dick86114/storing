package com.idickies.storing.ui.components

import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
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

/* 对齐设计稿：底部导航栏
   - 高度 64dp，纯色底 + 顶部 0.5dp 分隔线
   - icon 20dp + label 10sp
   - 选中态：浅色=深绿(secondary)，深色=金色(primary) + 下方横条指示器
   - badge：金色小圆点，带脉冲动画 */

data class CompactBottomBarMetrics(
  val actionHeight: androidx.compose.ui.unit.Dp,
  val verticalInset: androidx.compose.ui.unit.Dp,
) {
  val totalHeight: androidx.compose.ui.unit.Dp get() = actionHeight + (verticalInset * 2)
}

val compactBottomBarMetrics = CompactBottomBarMetrics(
  actionHeight = 64.dp,
  verticalInset = 0.dp,
)

@Composable
private fun navSelectedColor(): Color =
  if (isSystemInDarkTheme()) MaterialTheme.colorScheme.primary
  else MaterialTheme.colorScheme.secondary

@Composable
fun QiankunjieCompactBottomBar(
  modifier: Modifier = Modifier,
  content: @Composable () -> Unit,
) {
  Column(
    modifier = modifier
      .fillMaxWidth()
      .background(MaterialTheme.colorScheme.surfaceVariant),
  ) {
    HorizontalDivider(thickness = 0.5.dp, color = MaterialTheme.colorScheme.outline.copy(alpha = 0.6f))
    Row(
      modifier = Modifier
        .fillMaxWidth()
        .windowInsetsPadding(WindowInsets.navigationBars)
        .padding(horizontal = 4.dp)
        .height(compactBottomBarMetrics.actionHeight),
      horizontalArrangement = Arrangement.SpaceEvenly,
      verticalAlignment = Alignment.CenterVertically,
    ) {
      content()
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
      .padding(horizontal = 8.dp),
    horizontalAlignment = Alignment.CenterHorizontally,
    verticalArrangement = Arrangement.spacedBy(2.dp),
  ) {
    // Icon + Badge
    Box(contentAlignment = Alignment.TopEnd) {
      Icon(
        imageVector = icon,
        contentDescription = label,
        modifier = Modifier.size(20.dp),
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
            .offset(x = 6.dp, y = (-4).dp)
            .size(16.dp)
            .alpha(pulseAlpha),
        ) {
          Text(
            if (badgeCount > 99) "99+" else badgeCount.toString(),
            fontSize = 9.sp,
            fontWeight = androidx.compose.ui.text.font.FontWeight.Bold,
            modifier = Modifier.wrapContentSize(Alignment.Center),
          )
        }
      }
    }
    // Label
    Text(
      label,
      fontSize = 10.sp,
      fontWeight = if (selected) androidx.compose.ui.text.font.FontWeight.Medium else androidx.compose.ui.text.font.FontWeight.Normal,
      color = contentColor,
    )
    // 指示器横条：仅亮色模式显示（暗色靠颜色区分）
    if (!isSystemInDarkTheme() && selected) {
      Spacer(Modifier.height(1.dp))
      Box(
        modifier = Modifier
          .width(16.dp)
          .height(2.dp)
          .background(selectedColor, CircleShape),
      )
    }
  }
}
