package com.idickies.storing.ui.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Archive
import androidx.compose.material.icons.outlined.Favorite
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material.icons.outlined.IosShare
import androidx.compose.material.icons.outlined.MoveToInbox
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/** Reader actions deliberately use the same 68 dp target as the library bottom navigation. */
data class ReaderActionBarMetrics(val actionHeight: Dp)

val readerActionBarMetrics = ReaderActionBarMetrics(
  actionHeight = compactBottomBarMetrics.actionHeight,
)

/**
 * Reader bottom bar: left "阅读原文" shows the original source identity;
 * the right side provides favorite, archive and share actions.
 */
@Composable
fun ReaderActionBar(
  source: String?,
  originalUrl: String?,
  isFavorited: Boolean,
  isArchived: Boolean,
  shareEnabled: Boolean,
  onOpenOriginal: () -> Unit,
  onFavorite: () -> Unit,
  onArchive: () -> Unit,
  onShare: () -> Unit,
  modifier: Modifier = Modifier,
) {
  val originalEnabled = !originalUrl.isNullOrBlank()
  val originalTint = if (originalEnabled) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.38f)
  QiankunjieCompactBottomBar(modifier = modifier) {
    Row(
      modifier = Modifier.fillMaxWidth(),
      horizontalArrangement = Arrangement.SpaceBetween,
      verticalAlignment = Alignment.CenterVertically,
    ) {
      Row(
        modifier = Modifier
          .weight(1f, fill = false)
          .clickable(enabled = originalEnabled, onClick = onOpenOriginal)
          .padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
      ) {
        ArticleSourceIdentityIcon(
          source = source,
          originalUrl = originalUrl,
          tint = originalTint,
          size = 18.dp,
        )
        Spacer(Modifier.width(6.dp))
        Text(
          "阅读原文",
          style = MaterialTheme.typography.bodyMedium,
          color = originalTint,
          maxLines = 1,
          overflow = TextOverflow.Ellipsis,
        )
      }
      Row(
        horizontalArrangement = Arrangement.spacedBy(2.dp),
        verticalAlignment = Alignment.CenterVertically,
      ) {
        ReaderAction(
          icon = if (isFavorited) Icons.Outlined.Favorite else Icons.Outlined.FavoriteBorder,
          label = if (isFavorited) "已收藏" else "收藏",
          tint = if (isFavorited) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
          onClick = onFavorite,
        )
        ReaderAction(
          icon = if (isArchived) Icons.Outlined.MoveToInbox else Icons.Outlined.Archive,
          label = if (isArchived) "移回" else "归档",
          tint = if (isArchived) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
          onClick = onArchive,
        )
        ReaderAction(
          icon = Icons.Outlined.IosShare,
          label = "分享",
          tint = MaterialTheme.colorScheme.onSurfaceVariant,
          enabled = shareEnabled,
          onClick = onShare,
        )
      }
    }
  }
}

@Composable
private fun ReaderAction(
  icon: ImageVector,
  label: String,
  tint: androidx.compose.ui.graphics.Color,
  enabled: Boolean = true,
  onClick: () -> Unit,
) {
  Column(
    horizontalAlignment = Alignment.CenterHorizontally,
    modifier = Modifier.padding(horizontal = 6.dp, vertical = 2.dp),
  ) {
    IconButton(onClick = onClick, enabled = enabled, modifier = Modifier.size(36.dp)) {
      Icon(icon, contentDescription = label, tint = if (enabled) tint else tint.copy(alpha = 0.38f), modifier = Modifier.size(20.dp))
    }
    Text(label, style = MaterialTheme.typography.labelSmall, color = if (enabled) tint else tint.copy(alpha = 0.38f), maxLines = 1)
  }
}
