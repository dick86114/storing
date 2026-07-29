package com.idickies.storing.ui

import android.content.Context
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.Clear
import androidx.compose.material.icons.outlined.History
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.idickies.storing.library.ArticleCard
import com.idickies.storing.library.LibraryUiState
import com.idickies.storing.ui.components.QiankunjieArticleCard

@Composable
@androidx.compose.material3.ExperimentalMaterial3Api
internal fun LibrarySearchScreen(initialQuery: String, state: LibraryUiState, onBack: () -> Unit, onSearch: (String) -> Unit, onOpen: (Int) -> Unit, onLongPress: (ArticleCard) -> Unit) {
  val context = LocalContext.current
  val prefs = remember { context.getSharedPreferences("library_search_history", Context.MODE_PRIVATE) }
  val history = remember { mutableStateListOf<String>().apply { addAll(prefs.getStringSet("queries", emptySet()).orEmpty()) } }
  var query by rememberSaveable { mutableStateOf(initialQuery) }
  fun persist() { prefs.edit().putStringSet("queries", history.toSet()).apply() }
  fun submit(value: String) { val normalized = value.trim(); if (normalized.isBlank()) return; history.removeAll { it.equals(normalized, true) }; history.add(0, normalized); while (history.size > 20) history.removeLast(); persist(); onSearch(normalized) }
  BackHandler(onBack = onBack)
  Scaffold(topBar = { TopAppBar(title = { OutlinedTextField(value = query, onValueChange = { query = it; onSearch(it) }, singleLine = true, placeholder = { Text("搜索文章") }, leadingIcon = { Icon(Icons.Outlined.Search, null) }, trailingIcon = { if (query.isNotEmpty()) IconButton(onClick = { query = ""; onSearch("") }) { Icon(Icons.Outlined.Clear, "清空") } }, modifier = Modifier.fillMaxWidth(), shape = libraryControlShape) }, navigationIcon = { IconButton(onClick = onBack) { Icon(Icons.AutoMirrored.Outlined.ArrowBack, "返回") } }) }) { padding ->
    if (query.isBlank()) LazyColumn(Modifier.fillMaxSize().padding(padding).padding(16.dp)) {
      item { Text("搜索历史", style = MaterialTheme.typography.titleMedium); TextButton(onClick = { history.clear(); persist() }, enabled = history.isNotEmpty()) { Text("清空历史") } }
      items(history, key = { it }) { item -> androidx.compose.foundation.layout.Row(modifier = Modifier.fillMaxWidth().clickable { query = item; submit(item) }.padding(vertical = 14.dp)) { Icon(Icons.Outlined.History, null, modifier = Modifier.padding(end = 12.dp)); Text(item, maxLines = 1, overflow = TextOverflow.Ellipsis) } }
    } else LazyColumn(Modifier.fillMaxSize().padding(padding).padding(16.dp)) { items(state.articles, key = { it.id }) { article -> QiankunjieArticleCard(article, onOpen, onLongPress) } }
  }
  LaunchedEffect(initialQuery) { if (initialQuery.isNotBlank()) query = initialQuery }
}
