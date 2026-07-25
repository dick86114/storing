package com.idickies.storing.ui.components

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Archive
import androidx.compose.material.icons.outlined.Bookmark
import androidx.compose.material.icons.outlined.BookmarkBorder
import androidx.compose.material.icons.outlined.Favorite
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material.icons.outlined.IosShare
import androidx.compose.material.icons.outlined.MoveToInbox
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

/** Reader-specific bottom bar with bookmark, favorite, archive, and share. */
@Composable
fun ReaderActionBar(
  isFavorited: Boolean,
  isArchived: Boolean,
  isBookmarked: Boolean,
  shareEnabled: Boolean,
  onBookmark: () -> Unit,
  onFavorite: () -> Unit,
  onArchive: () -> Unit,
  onShare: () -> Unit,
  modifier: Modifier = Modifier,
) {
  Surface(
    modifier = modifier.fillMaxWidth(),
    color = MaterialTheme.colorScheme.surface.copy(alpha = 0.95f),
    shadowElevation = 2.dp,
  ) {
    Row(
      modifier = Modifier.fillMaxWidth().padding(horizontal = 8.dp, vertical = 4.dp),
      horizontalArrangement = Arrangement.SpaceEvenly,
      verticalAlignment = Alignment.CenterVertically,
    ) {
      ReaderAction(
        icon = if (isBookmarked) Icons.Outlined.Bookmark else Icons.Outlined.BookmarkBorder,
        label = "书签",
        tint = if (isBookmarked) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant,
        onClick = onBookmark,
      )
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

@Composable
private fun ReaderAction(
  icon: androidx.compose.ui.graphics.vector.ImageVector,
  label: String,
  tint: androidx.compose.ui.graphics.Color,
  enabled: Boolean = true,
  onClick: () -> Unit,
) {
  Column(
    horizontalAlignment = Alignment.CenterHorizontally,
    modifier = Modifier.padding(horizontal = 8.dp, vertical = 4.dp),
  ) {
    IconButton(onClick = onClick, enabled = enabled, modifier = Modifier.size(40.dp)) {
      Icon(icon, contentDescription = label, tint = if (enabled) tint else tint.copy(alpha = 0.38f), modifier = Modifier.size(22.dp))
    }
    Text(label, style = MaterialTheme.typography.labelSmall, color = if (enabled) tint else tint.copy(alpha = 0.38f))
  }
}
