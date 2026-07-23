package com.idickies.storing.ui.components

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Archive
import androidx.compose.material.icons.outlined.Favorite
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material.icons.outlined.IosShare
import androidx.compose.material.icons.outlined.MoveToInbox
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

/** Persistent reader actions with clear labels and selected-state feedback. */
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
  NavigationBar(
    modifier = modifier,
    containerColor = MaterialTheme.colorScheme.surface,
    tonalElevation = 3.dp,
  ) {
    NavigationBarItem(
      selected = isFavorited,
      onClick = onFavorite,
      icon = {
        Icon(
          imageVector = if (isFavorited) Icons.Outlined.Favorite else Icons.Outlined.FavoriteBorder,
          contentDescription = if (isFavorited) "取消收藏" else "收藏",
        )
      },
      label = { Text(if (isFavorited) "已收藏" else "收藏") },
      alwaysShowLabel = true,
    )
    NavigationBarItem(
      selected = isArchived,
      onClick = onArchive,
      icon = {
        Icon(
          imageVector = if (isArchived) Icons.Outlined.MoveToInbox else Icons.Outlined.Archive,
          contentDescription = if (isArchived) "移回收件箱" else "归档",
        )
      },
      label = { Text(if (isArchived) "移回" else "归档") },
      alwaysShowLabel = true,
    )
    NavigationBarItem(
      selected = false,
      onClick = onShare,
      enabled = shareEnabled,
      icon = { Icon(Icons.Outlined.IosShare, contentDescription = "分享原网页") },
      label = { Text("分享") },
      alwaysShowLabel = true,
    )
  }
}
