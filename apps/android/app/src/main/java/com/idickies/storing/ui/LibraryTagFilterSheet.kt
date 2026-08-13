package com.idickies.storing.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.CheckBox
import androidx.compose.material.icons.outlined.CheckBoxOutlineBlank
import androidx.compose.material.icons.outlined.Close
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.idickies.storing.library.ArchiveTagFilter
import com.idickies.storing.library.ArticleTag
import com.idickies.storing.library.filteredArchiveTagOptions

@OptIn(ExperimentalMaterial3Api::class)
@Composable
internal fun LibraryTagFilterSheet(
  selected: ArchiveTagFilter,
  options: List<ArticleTag>,
  onDismiss: () -> Unit,
  onApply: (List<String>) -> Unit,
) {
  var query by rememberSaveable { mutableStateOf("") }
  var draft by remember(selected.tags) { mutableStateOf(selected.tags) }
  val visibleOptions = filteredArchiveTagOptions(options, query)
  ModalBottomSheet(onDismissRequest = onDismiss, containerColor = MaterialTheme.colorScheme.surface) {
    Column(modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp).padding(bottom = 20.dp)) {
      Row(modifier = Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
        Text("筛选标签", style = MaterialTheme.typography.titleLarge, modifier = Modifier.weight(1f))
        IconButton(onClick = onDismiss) { Icon(Icons.Outlined.Close, contentDescription = "关闭标签筛选") }
      }
      OutlinedTextField(
        value = query,
        onValueChange = { query = it },
        modifier = Modifier.fillMaxWidth().padding(top = 12.dp),
        singleLine = true,
        leadingIcon = { Icon(Icons.Outlined.Search, contentDescription = null) },
        label = { Text("搜索标签") },
        shape = libraryControlShape,
      )
      Row(modifier = Modifier.fillMaxWidth().padding(top = 8.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(if (draft.isEmpty()) "未筛选，显示全部标签" else "已选择 ${draft.size} 个标签", style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant, modifier = Modifier.weight(1f))
        TextButton(onClick = { draft = emptyList() }, enabled = draft.isNotEmpty()) { Text("清空筛选") }
      }
      LazyColumn(modifier = Modifier.fillMaxWidth().weight(1f, fill = false)) {
        items(visibleOptions, key = { it.tag }) { tag ->
          val checked = tag.tag in draft
          Row(
            modifier = Modifier.fillMaxWidth().clickable { draft = if (checked) draft - tag.tag else draft + tag.tag }.padding(vertical = 13.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(12.dp),
          ) {
            Icon(if (checked) Icons.Outlined.CheckBox else Icons.Outlined.CheckBoxOutlineBlank, contentDescription = null, tint = if (checked) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurfaceVariant)
            Text(tag.tag, modifier = Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text("${tag.count}", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.labelMedium)
          }
        }
      }
      Spacer(Modifier.height(12.dp))
      Button(onClick = { onApply(draft); onDismiss() }, modifier = Modifier.fillMaxWidth(), shape = libraryControlShape) {
        Text(if (draft.isEmpty()) "查看全部标签" else "查看 ${draft.size} 个标签的文章")
      }
    }
  }
}
