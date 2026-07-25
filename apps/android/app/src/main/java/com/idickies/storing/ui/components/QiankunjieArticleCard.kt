package com.idickies.storing.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AutoStories
import androidx.compose.material.icons.outlined.Inventory2
import androidx.compose.material.icons.outlined.Public
import androidx.compose.material.icons.outlined.Star
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
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import com.idickies.storing.library.ArticleCard

private val CoverHeight = 156.dp
private val CompactThumbnailSize = 96.dp

/** 文章卡片：封面图在上，标题/摘要/标签在下 */
@Composable
fun QiankunjieArticleCard(
  article: ArticleCard,
  onOpen: (Int) -> Unit,
  onLongPress: (ArticleCard) -> Unit = {},
  modifier: Modifier = Modifier,
) {
  Card(
    modifier = modifier
      .fillMaxWidth()
      .combinedClickable(onClick = { onOpen(article.id) }, onLongClick = { onLongPress(article) }),
    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    shape = MaterialTheme.shapes.large,
  ) {
    Column {
      ArticleThumbnail(
        article = article,
        modifier = Modifier.fillMaxWidth().height(CoverHeight),
        shape = RoundedCornerShape(topStart = 24.dp, topEnd = 24.dp),
      )
      Column(modifier = Modifier.padding(16.dp)) {
        ArticleMetadata(article)
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
        if (article.aiTags.isNotEmpty()) {
          Row(
            modifier = Modifier.padding(top = 12.dp).fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically,
          ) {
            article.aiTags.take(3).forEach { tag ->
              TagPill(tag)
            }
            if (article.aiTags.size > 3) {
              Text(
                "+${article.aiTags.size - 3}",
                style = MaterialTheme.typography.labelMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
              )
            }
          }
        }
      }
    }
  }
}

/** 紧凑行布局：左文右缩略图 */
@Composable
fun QiankunjieCompactArticleRow(
  article: ArticleCard,
  onOpen: (Int) -> Unit,
  onLongPress: (ArticleCard) -> Unit = {},
  modifier: Modifier = Modifier,
) {
  Card(
    modifier = modifier
      .fillMaxWidth()
      .combinedClickable(onClick = { onOpen(article.id) }, onLongClick = { onLongPress(article) }),
    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
    elevation = CardDefaults.cardElevation(defaultElevation = 2.dp),
    shape = MaterialTheme.shapes.medium,
  ) {
    Row(
      modifier = Modifier.padding(10.dp),
      horizontalArrangement = Arrangement.spacedBy(12.dp),
      verticalAlignment = Alignment.CenterVertically,
    ) {
      ArticleThumbnail(
        article = article,
        modifier = Modifier.size(CompactThumbnailSize),
        shape = MaterialTheme.shapes.small,
      )
      Column(modifier = Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        ArticleMetadata(article)
        Text(
          article.displayTitle,
          style = MaterialTheme.typography.titleMedium,
          maxLines = 2,
          overflow = TextOverflow.Ellipsis,
        )
        article.aiSummary?.takeIf { it.isNotBlank() }?.let { summary ->
          Text(
            summary,
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
          )
        }
      }
    }
  }
}

@Composable
private fun ArticleMetadata(article: ArticleCard) {
  Row(
    verticalAlignment = Alignment.CenterVertically,
    horizontalArrangement = Arrangement.spacedBy(6.dp),
  ) {
    if (!article.source.isNullOrBlank()) {
      Text(
        article.source!!,
        style = MaterialTheme.typography.labelMedium,
        color = MaterialTheme.colorScheme.primary,
        maxLines = 1,
        overflow = TextOverflow.Ellipsis,
      )
    }
    if (article.isFavorited) Icon(Icons.Outlined.Star, contentDescription = "已收藏", modifier = Modifier.size(14.dp), tint = MaterialTheme.colorScheme.primary)
    if (article.isArchived) Icon(Icons.Outlined.Inventory2, contentDescription = "已归档", modifier = Modifier.size(14.dp), tint = MaterialTheme.colorScheme.onSurfaceVariant)
    if (article.isPublished) Icon(Icons.Outlined.Public, contentDescription = "已发布", modifier = Modifier.size(14.dp), tint = MaterialTheme.colorScheme.tertiary)
  }
}

@Composable
private fun TagPill(text: String) {
  Box(
    modifier = Modifier
      .clip(RoundedCornerShape(99.dp))
      .background(MaterialTheme.colorScheme.secondaryContainer.copy(alpha = 0.6f))
      .padding(horizontal = 10.dp, vertical = 3.dp),
    contentAlignment = Alignment.Center,
  ) {
    Text(
      text,
      style = MaterialTheme.typography.labelMedium,
      color = MaterialTheme.colorScheme.secondary,
      maxLines = 1,
    )
  }
}

@Composable
private fun ArticleThumbnail(article: ArticleCard, modifier: Modifier, shape: Shape) {
  val palette = ArticleVisualPalettes.forArticle(article.id)
  val imageUrl = article.coverImage?.trim()?.takeIf { it.startsWith("https://") || it.startsWith("http://") }
  Box(
    modifier = modifier.clip(shape).background(Brush.linearGradient(listOf(palette.start, palette.end))),
    contentAlignment = Alignment.Center,
  ) {
    Icon(
      imageVector = Icons.Outlined.AutoStories,
      contentDescription = "文章视觉占位",
      tint = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.9f),
      modifier = Modifier.size(34.dp),
    )
    imageUrl?.let { url ->
      AsyncImage(
        model = url,
        contentDescription = "${article.displayTitle} 的封面图",
        contentScale = ContentScale.Crop,
        modifier = Modifier.fillMaxSize(),
      )
    }
  }
}
