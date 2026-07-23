package com.idickies.storing.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AutoStories
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.idickies.storing.library.ArticleCard

private val WechatCoverHeight = 156.dp

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
    shape = MaterialTheme.shapes.large,
  ) {
    Column {
      ArticleVisual(article = article)
      Column(modifier = Modifier.padding(16.dp)) {
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
            modifier = Modifier.padding(top = 8.dp),
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
          )
        }
        Row(
          modifier = Modifier.padding(top = 12.dp),
          horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
          article.aiTags.take(2).forEach { tag -> AssistChip(onClick = {}, label = { Text(tag) }) }
          if (article.isFavorited) AssistChip(onClick = {}, label = { Text("已收藏") })
          if (article.isArchived) AssistChip(onClick = {}, label = { Text("已归档") })
        }
      }
    }
  }
}

@Composable
private fun ArticleVisual(article: ArticleCard) {
  val shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp)
  val imageUrl = article.coverImage?.takeIf { it.isNotBlank() }
  Box(
    modifier = Modifier
      .fillMaxWidth()
      .height(WechatCoverHeight)
      .clip(shape),
    contentAlignment = Alignment.Center,
  ) {
    if (imageUrl != null) {
      AsyncImage(
        model = imageUrl,
        contentDescription = "${article.displayTitle} 的封面图",
        contentScale = ContentScale.Crop,
        modifier = Modifier.fillMaxWidth(),
      )
    } else {
      val palette = ArticleVisualPalettes.forArticle(article.id)
      Box(
        modifier = Modifier
          .fillMaxWidth()
          .height(WechatCoverHeight)
          .background(Brush.linearGradient(listOf(palette.start, palette.end))),
        contentAlignment = Alignment.Center,
      ) {
        Icon(
          imageVector = Icons.Outlined.AutoStories,
          contentDescription = "文章视觉占位",
          tint = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.9f),
          modifier = Modifier.size(34.dp),
        )
      }
    }
  }
}
