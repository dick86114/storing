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
import androidx.compose.material.icons.automirrored.outlined.OpenInNew
import androidx.compose.material.icons.automirrored.outlined.Chat
import androidx.compose.material.icons.outlined.Archive
import androidx.compose.material.icons.outlined.Favorite
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material.icons.outlined.IosShare
import androidx.compose.material.icons.outlined.Language
import androidx.compose.material.icons.outlined.MoveToInbox
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp

/**
 * Reader bottom bar: left "阅读原文" with source icon, right favorite/archive/share.
 */
@Composable
fun ReaderActionBar(
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
  val isWeChat = originalUrl?.contains("mp.weixin.qq.com") == true ||
    originalUrl?.contains("weixin.qq.com") == true
  val sourceIcon = if (isWeChat) Icons.AutoMirrored.Outlined.Chat else Icons.Outlined.Language
  Surface(
    modifier = modifier.fillMaxWidth(),
    color = MaterialTheme.colorScheme.surface.copy(alpha = 0.97f),
    shadowElevation = 3.dp,
  ) {
    Row(
      modifier = Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 6.dp),
      horizontalArrangement = Arrangement.SpaceBetween,
      verticalAlignment = Alignment.CenterVertically,
    ) {
      // Left: 阅读原文 with source icon
      Row(
        modifier = Modifier.clickable(enabled = !originalUrl.isNullOrBlank(), onClick = onOpenOriginal).padding(vertical = 4.dp),
        verticalAlignment = Alignment.CenterVertically,
      ) {
        Icon(
          sourceIcon,
          contentDescription = null,
          tint = if (originalUrl.isNullOrBlank()) MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.38f) else MaterialTheme.colorScheme.primary,
          modifier = Modifier.size(18.dp),
        )
        Spacer(Modifier.width(6.dp))
        Text(
          "阅读原文",
          style = MaterialTheme.typography.bodyMedium,
          color = if (originalUrl.isNullOrBlank()) MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.38f) else MaterialTheme.colorScheme.primary,
          maxLines = 1,
          overflow = TextOverflow.Ellipsis,
        )
      }
      // Right: favorite, archive, share
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
