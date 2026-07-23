package com.idickies.storing.ui.components

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Archive
import androidx.compose.material.icons.outlined.Favorite
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material.icons.outlined.IosShare
import androidx.compose.material.icons.outlined.MoveToInbox
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier

/** Persistent reader actions with compact touch targets and selected-state feedback. */
@Composable
fun ReaderActionBar(
  isFavorited: Boolean,
  isArchived: Boolean,
  shareEnabled: Boolean,
  onFavorite: () -> Unit,
  onArchive: () -> Unit,
  onShare: () -> Unit,
  modifier: Modifier = Modifier,
) {
  QiankunjieCompactBottomBar(modifier = modifier) {
    CompactBottomBarItem(
      label = if (isFavorited) "已收藏" else "收藏",
      icon = if (isFavorited) Icons.Outlined.Favorite else Icons.Outlined.FavoriteBorder,
      selected = isFavorited,
      onClick = onFavorite,
    )
    CompactBottomBarItem(
      label = if (isArchived) "移回" else "归档",
      icon = if (isArchived) Icons.Outlined.MoveToInbox else Icons.Outlined.Archive,
      selected = isArchived,
      onClick = onArchive,
    )
    CompactBottomBarItem(
      label = "分享",
      icon = Icons.Outlined.IosShare,
      selected = false,
      enabled = shareEnabled,
      onClick = onShare,
    )
  }
}
