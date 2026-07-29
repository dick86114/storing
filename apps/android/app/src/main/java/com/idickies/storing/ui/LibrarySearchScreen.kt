package com.idickies.storing.ui

import com.idickies.storing.ui.theme.isQiankunjieDarkTheme

import android.content.Context
import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.outlined.ArrowBack
import androidx.compose.material.icons.outlined.Clear
import androidx.compose.material.icons.outlined.History
import androidx.compose.material.icons.outlined.Search
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import com.idickies.storing.library.ArticleCard
import com.idickies.storing.library.LibraryUiState
import com.idickies.storing.ui.components.LiquidGlassRole
import com.idickies.storing.ui.components.QiankunjieArticleCard
import com.idickies.storing.ui.components.liquidGlassBackdropBrush
import com.idickies.storing.ui.components.liquidGlassSurfaceColor
import kotlinx.coroutines.delay

@Composable
@androidx.compose.material3.ExperimentalMaterial3Api
internal fun LibrarySearchScreen(
  initialQuery: String,
  state: LibraryUiState,
  onBack: () -> Unit,
  onSearch: (String) -> Unit,
  onOpen: (Int) -> Unit,
  onLongPress: (ArticleCard) -> Unit,
) {
  val context = LocalContext.current
  val prefs = remember { context.getSharedPreferences("library_search_history", Context.MODE_PRIVATE) }
  val history = remember { mutableStateListOf<String>().apply { addAll(prefs.getStringSet("queries", emptySet()).orEmpty()) } }
  var query by rememberSaveable { mutableStateOf(initialQuery) }
  var lastDispatchedQuery by remember { mutableStateOf<String?>(null) }
  val isDark = isQiankunjieDarkTheme()

  fun persist() = prefs.edit().putStringSet("queries", history.toSet()).apply()
  fun dispatchSearch(value: String) {
    val normalized = value.trim()
    if (lastDispatchedQuery == normalized) return
    lastDispatchedQuery = normalized
    onSearch(normalized)
  }
  fun submit(value: String) {
    val normalized = value.trim()
    if (normalized.isBlank()) {
      dispatchSearch("")
      return
    }
    history.removeAll { it.equals(normalized, true) }
    history.add(0, normalized)
    while (history.size > 20) history.removeLast()
    persist()
    dispatchSearch(normalized)
  }

  BackHandler(onBack = onBack)
  LaunchedEffect(query) {
    delay(libraryInteractionMetrics.searchDebounceMillis)
    dispatchSearch(query)
  }
  LaunchedEffect(initialQuery) {
    if (initialQuery.isNotBlank()) query = initialQuery
  }

  Scaffold(
    modifier = Modifier.background(liquidGlassBackdropBrush()),
    containerColor = Color.Transparent,
    contentColor = MaterialTheme.colorScheme.onBackground,
    topBar = {
      TopAppBar(
        colors = TopAppBarDefaults.topAppBarColors(
          containerColor = liquidGlassSurfaceColor(LiquidGlassRole.Chrome),
        ),
        navigationIcon = {
          IconButton(onClick = onBack) {
            Icon(Icons.AutoMirrored.Outlined.ArrowBack, contentDescription = "返回资料库")
          }
        },
        title = {
          LibraryCompactSearchField(
            value = query,
            onValueChange = { query = it },
            onSubmit = { submit(query) },
            onClear = { query = ""; dispatchSearch("") },
            isDark = isDark,
          )
        },
      )
    },
  ) { padding ->
    if (query.isBlank()) {
      LazyColumn(
        modifier = Modifier.fillMaxSize().padding(padding),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(horizontal = 20.dp, vertical = 16.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
      ) {
        item {
          Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
          ) {
            Text("搜索历史", style = MaterialTheme.typography.titleMedium)
            TextButton(onClick = { history.clear(); persist() }, enabled = history.isNotEmpty()) { Text("清空") }
          }
        }
        items(history, key = { it }) { item ->
          Row(
            modifier = Modifier
              .fillMaxWidth()
              .clip(MaterialTheme.shapes.medium)
              .clickable { query = item; submit(item) }
              .padding(horizontal = 12.dp, vertical = 13.dp),
            verticalAlignment = Alignment.CenterVertically,
          ) {
            Icon(Icons.Outlined.History, contentDescription = null, modifier = Modifier.padding(end = 12.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
            Text(item, maxLines = 1, overflow = TextOverflow.Ellipsis)
          }
        }
      }
    } else {
      LazyColumn(
        modifier = Modifier.fillMaxSize().padding(padding),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
      ) {
        items(state.articles, key = { it.id }) { article ->
          QiankunjieArticleCard(article, onOpen, onLongPress)
        }
      }
    }
  }
}

@Composable
private fun LibraryCompactSearchField(
  value: String,
  onValueChange: (String) -> Unit,
  onSubmit: () -> Unit,
  onClear: () -> Unit,
  isDark: Boolean,
) {
  val shape = RoundedCornerShape(15.dp)
  val borderColor = if (isDark) MaterialTheme.colorScheme.outline.copy(alpha = 0.72f) else Color.White.copy(alpha = 0.76f)
  val containerColor = if (isDark) MaterialTheme.colorScheme.surfaceVariant else MaterialTheme.colorScheme.surface.copy(alpha = 0.74f)

  BasicTextField(
    value = value,
    onValueChange = onValueChange,
    singleLine = true,
    textStyle = MaterialTheme.typography.bodyMedium.copy(color = MaterialTheme.colorScheme.onSurface),
    cursorBrush = SolidColor(MaterialTheme.colorScheme.primary),
    keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Text, imeAction = ImeAction.Search),
    keyboardActions = KeyboardActions(onSearch = { onSubmit() }),
    modifier = Modifier
      .fillMaxWidth()
      .height(libraryInteractionMetrics.searchFieldHeight)
      .clip(shape)
      .background(containerColor)
      .border(0.8.dp, borderColor, shape),
    decorationBox = { innerTextField ->
      Box(modifier = Modifier.fillMaxSize()) {
        Icon(
          Icons.Outlined.Search,
          contentDescription = null,
          tint = MaterialTheme.colorScheme.onSurfaceVariant,
          modifier = Modifier
            .align(Alignment.CenterStart)
            .padding(start = 11.dp)
            .size(19.dp),
        )
        Box(
          modifier = Modifier
            .fillMaxWidth()
            .align(Alignment.CenterStart)
            .padding(start = 39.dp, end = if (value.isNotEmpty()) 39.dp else 11.dp),
          contentAlignment = Alignment.CenterStart,
        ) {
          if (value.isBlank()) {
            Text("搜索文章", color = MaterialTheme.colorScheme.onSurfaceVariant, style = MaterialTheme.typography.bodyMedium)
          }
          innerTextField()
        }
        if (value.isNotEmpty()) {
          IconButton(
            onClick = onClear,
            modifier = Modifier
              .align(Alignment.CenterEnd)
              .padding(end = 5.dp)
              .size(30.dp),
          ) {
            Icon(Icons.Outlined.Clear, contentDescription = "清空搜索", modifier = Modifier.size(18.dp))
          }
        }
      }
    },
  )
}
