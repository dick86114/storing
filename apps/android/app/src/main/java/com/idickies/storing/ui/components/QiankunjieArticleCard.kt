package com.idickies.storing.ui.components

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.idickies.storing.library.ArticleCard

@Composable
fun QiankunjieArticleCard(
  article: ArticleCard,
  onOpen: (Int) -> Unit,
  modifier: Modifier = Modifier,
) {
  Card(
    modifier = modifier.fillMaxWidth().clickable { onOpen(article.id) },
    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
  ) {
    Column(Modifier.padding(horizontal = 18.dp, vertical = 16.dp)) {
      listOfNotNull(article.source, article.author).takeIf { it.isNotEmpty() }?.let { metadata ->
        Text(
          metadata.joinToString(" · "),
          style = MaterialTheme.typography.labelMedium,
          color = MaterialTheme.colorScheme.primary,
          maxLines = 1,
          overflow = TextOverflow.Ellipsis,
        )
      }
      Text(
        article.displayTitle,
        style = MaterialTheme.typography.titleLarge,
        modifier = Modifier.padding(top = 7.dp),
        maxLines = 2,
        overflow = TextOverflow.Ellipsis,
      )
      article.aiSummary?.takeIf { it.isNotBlank() }?.let { summary ->
        Text(
          summary,
          style = MaterialTheme.typography.bodyMedium,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
          modifier = Modifier.padding(top = 9.dp),
          maxLines = 3,
          overflow = TextOverflow.Ellipsis,
        )
      }
      Row(
        modifier = Modifier.padding(top = 13.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
      ) {
        article.aiTags.take(2).forEach { tag -> AssistChip(onClick = {}, label = { Text(tag) }) }
        if (article.isFavorited) AssistChip(onClick = {}, label = { Text("已收藏") })
        if (article.isArchived) AssistChip(onClick = {}, label = { Text("已归档") })
      }
    }
  }
}
