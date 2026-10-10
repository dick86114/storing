package com.idickies.storing.ui.components

import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Archive
import androidx.compose.material.icons.outlined.AutoAwesome
import androidx.compose.material.icons.outlined.Category
import androidx.compose.material.icons.outlined.DeleteForever
import androidx.compose.material.icons.outlined.DeleteOutline
import androidx.compose.material.icons.outlined.Favorite
import androidx.compose.material.icons.outlined.FavoriteBorder
import androidx.compose.material.icons.outlined.FolderOpen
import androidx.compose.material.icons.outlined.MoveToInbox
import androidx.compose.material.icons.outlined.Public
import androidx.compose.material.icons.outlined.PublicOff
import androidx.compose.material.icons.outlined.TaskAlt
import androidx.compose.material.icons.outlined.UploadFile
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.idickies.storing.library.ArticleBulkExportStatus
import com.idickies.storing.library.BulkToolbarAction
import com.idickies.storing.library.LibraryView
import com.idickies.storing.library.NativeBulkResult
import com.idickies.storing.library.bulkActionConfirmation
import com.idickies.storing.library.bulkToolbarActionTitle
import com.idickies.storing.library.bulkToolbarActions
import com.idickies.storing.ui.QiankunjieAlertDialog

@Composable
fun AndroidBulkActionBar(
  view: LibraryView,
  isSelecting: Boolean,
  selectedIds: Set<Int>,
  runningAction: BulkToolbarAction?,
  result: NativeBulkResult?,
  exportJob: com.idickies.storing.library.ArticleBulkExportJob?,
  downloadingExport: Boolean,
  onEnter: () -> Unit,
  onExit: () -> Unit,
  onToggle: (Int) -> Unit,
  onSelectAll: () -> Unit,
  onInvert: () -> Unit,
  onAction: (BulkToolbarAction, Set<Int>) -> Unit,
  onDismissResult: () -> Unit,
  onDownloadExport: () -> Unit,
  modifier: Modifier = Modifier,
) {
  var menuOpen by remember { mutableStateOf(false) }
  var pendingAction by remember { mutableStateOf<BulkToolbarAction?>(null) }

  if (!isSelecting) {
    TextButton(onClick = {
      onEnter()
    }, modifier = modifier) {
      androidx.compose.material3.Icon(
        Icons.Outlined.TaskAlt,
        contentDescription = null,
        modifier = Modifier.padding(end = 4.dp),
      )
      Text("批量操作")
    }
    return
  }

  Row(
    modifier = modifier.fillMaxWidth(),
    horizontalArrangement = Arrangement.spacedBy(6.dp),
    verticalAlignment = Alignment.CenterVertically,
  ) {
    Text("已选 ${selectedIds.size}", style = MaterialTheme.typography.labelMedium)
    TextButton(onClick = onSelectAll, enabled = runningAction == null) { Text("全选") }
    TextButton(onClick = onInvert, enabled = runningAction == null) { Text("反选") }
    androidx.compose.material3.Button(
      onClick = { menuOpen = true },
      enabled = selectedIds.isNotEmpty() && runningAction == null,
    ) {
      Text("批量操作")
    }
    DropdownMenu(
      expanded = menuOpen,
      onDismissRequest = { menuOpen = false },
      modifier = Modifier
        .width(216.dp)
        .border(1.dp, MaterialTheme.colorScheme.outline.copy(alpha = 0.76f), RoundedCornerShape(20.dp)),
      containerColor = MaterialTheme.colorScheme.surfaceVariant,
      shape = RoundedCornerShape(20.dp),
    ) {
      Text(
        "批量动作",
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        style = MaterialTheme.typography.labelLarge,
        modifier = Modifier.padding(horizontal = 16.dp, vertical = 10.dp),
      )
      bulkToolbarActions(view).forEach { action ->
        DropdownMenuItem(
          text = {
            Text(
              bulkToolbarActionTitle(action),
              style = MaterialTheme.typography.bodyLarge,
              color = MaterialTheme.colorScheme.onSurface,
            )
          },
          leadingIcon = {
            androidx.compose.material3.Icon(
              when (action) {
                BulkToolbarAction.Favorite -> Icons.Outlined.FavoriteBorder
                BulkToolbarAction.Unfavorite -> Icons.Outlined.Favorite
                BulkToolbarAction.Archive -> Icons.Outlined.Archive
                BulkToolbarAction.Unarchive -> Icons.Outlined.MoveToInbox
                BulkToolbarAction.Delete -> Icons.Outlined.DeleteOutline
                BulkToolbarAction.PermanentDelete -> Icons.Outlined.DeleteForever
                BulkToolbarAction.Publish -> Icons.Outlined.Public
                BulkToolbarAction.Unpublish -> Icons.Outlined.PublicOff
                BulkToolbarAction.SetCategory -> Icons.Outlined.Category
                BulkToolbarAction.ReclassifyCategory -> Icons.Outlined.FolderOpen
                BulkToolbarAction.GenerateAi -> Icons.Outlined.AutoAwesome
                BulkToolbarAction.ExportZip -> Icons.Outlined.UploadFile
              },
              contentDescription = null,
              tint = MaterialTheme.colorScheme.onSurfaceVariant,
            )
          },
          onClick = {
            menuOpen = false
            pendingAction = action
          },
        )
      }
      HorizontalDivider(
        modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp),
        color = MaterialTheme.colorScheme.outline.copy(alpha = 0.38f),
        thickness = 0.5.dp,
      )
    }
    OutlinedButton(onClick = {
      onExit()
    }, enabled = runningAction == null) {
      Text("退出")
    }
  }

  pendingAction?.let { action ->
    val copy = bulkActionConfirmation(action, selectedIds.size)
    QiankunjieAlertDialog(
      onDismissRequest = { pendingAction = null },
      title = { Text(copy.title) },
      text = { Text(copy.message) },
      dismissButton = {
        TextButton(onClick = { pendingAction = null }) { Text("取消") }
      },
      confirmButton = {
        Button(
          onClick = {
            pendingAction = null
            onAction(action, selectedIds)
          },
          enabled = runningAction == null,
          colors = if (copy.isDanger) {
            ButtonDefaults.buttonColors(
              containerColor = MaterialTheme.colorScheme.error,
              contentColor = MaterialTheme.colorScheme.onError,
            )
          } else {
            ButtonDefaults.buttonColors()
          },
        ) { Text("确认执行") }
      },
    )
  }

  result?.let { result ->
    QiankunjieAlertDialog(
      onDismissRequest = onDismissResult,
      title = { Text("批量结果") },
      text = {
        Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
          Text("成功 ${result.succeededCount}，跳过 ${result.skippedCount}，失败 ${result.issues.size}。")
          if (result.issues.isNotEmpty()) {
            LazyColumn(modifier = Modifier.fillMaxWidth().padding(top = 4.dp)) {
              items(result.issues) { issue ->
                Text("#${issue.articleId} · ${issue.code}${issue.message?.let { " · $it" } ?: ""}", style = MaterialTheme.typography.bodySmall)
              }
            }
          }
          result.publications.forEach { publication ->
            Text("文章 #${publication.articleId}：${publication.publicUrl}", style = MaterialTheme.typography.bodySmall)
          }
        }
      },
      confirmButton = {
        TextButton(onClick = onDismissResult) { Text("知道了") }
      },
    )
  }

  exportJob?.let { job ->
    if (job.status != ArticleBulkExportStatus.Succeeded && job.status != ArticleBulkExportStatus.Failed) {
      QiankunjieAlertDialog(
        onDismissRequest = {},
        title = { Text("正在导出 ZIP") },
        text = { Text("已提交 ${job.requestedCount} 篇文章，请稍候。") },
        confirmButton = {},
      )
    } else if (job.status == ArticleBulkExportStatus.Succeeded) {
      QiankunjieAlertDialog(
        onDismissRequest = {},
        title = { Text("导出完成") },
        text = { Text("成功 ${job.succeededCount} 篇，失败 ${job.failedCount} 篇。") },
        dismissButton = {},
        confirmButton = {
          Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            TextButton(onClick = onDownloadExport, enabled = !downloadingExport) {
              Text(if (downloadingExport) "正在下载…" else "下载 ZIP")
            }
          }
        },
      )
    } else {
      QiankunjieAlertDialog(
        onDismissRequest = {},
        title = { Text("导出失败") },
        text = { Text("请重新提交批量导出。") },
        confirmButton = { TextButton(onClick = {}) { Text("知道了") } },
      )
    }
  }
}
