package com.idickies.storing.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.AutoStories
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

private val ThumbnailSize = 80.dp

/** 文章卡片：左文右图，对齐设计稿的列表布局 */
@Composable
fun QiankunjieArticleCard(
  article: ArticleCard,
  onOpen: (Int) -> Unit,
  onLongPress: (ArticleCard) -> Unit = {},
  modifier: Modifier = Modifier,
) {
  Row(
    modifier = modifier
      .fillMaxWidth()
      .clickable { onOpen(article.id) }
      .padding(horizontal = 16.dp, vertical = 14.dp),
    horizontalArrangement = Arrangement.spacedBy(12.dp),
    verticalAlignment = Alignment.Top,
  ) {
    Column(
      modifier = Modifier.weight(1f),
      verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
      // 标题
      Text(
        article.displayTitle,
        style = MaterialTheme.typography.titleMedium,
        color = MaterialTheme.colorScheme.onBackground,
        maxLines = 2,
        overflow = TextOverflow.Ellipsis,
      )
      // AI 摘要
      article.aiSummary?.takeIf { it.isNotBlank() }?.let { summary ->
        Text(
          summary,
          style = MaterialTheme.typography.bodyMedium,
          color = MaterialTheme.colorScheme.onSurfaceVariant,
          maxLines = 2,
          overflow = TextOverflow.Ellipsis,
        )
      }
      // Meta row: source · time
      Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
      ) {
        if (!article.source.isNullOrBlank()) {
          Text(
            article.source!!,
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.primary,
            maxLines = 1,
          )
          Text(
            "·",
            style = MaterialTheme.typography.labelMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
          )
        }
        // Time - article model doesn't have time field, just omit
      }
      // 标签
      if (article.aiTags.isNotEmpty()) {
        Row(
          horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
          article.aiTags.take(3).forEach { tag ->
            TagChip(tag)
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
    // 右侧缩略图
    ArticleCoverImage(article, Modifier.size(ThumbnailSize))
  }
}

/** 紧凑行布局 —— 与 QiankunjieArticleCard 统一风格 */
@Composable
fun QiankunjieCompactArticleRow(
  article: ArticleCard,
  onOpen: (Int) -> Unit,
  onLongPress: (ArticleCard) -> Unit = {},
  modifier: Modifier = Modifier,
) {
  Row(
    modifier = modifier
      .fillMaxWidth()
      .clickable { onOpen(article.id) }
      .padding(horizontal = 16.dp, vertical = 12.dp),
    horizontalArrangement = Arrangement.spacedBy(12.dp),
    verticalAlignment = Alignment.Top,
  ) {
    Column(
      modifier = Modifier.weight(1f),
      verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
      Text(
        article.displayTitle,
        style = MaterialTheme.typography.titleMedium,
        color = MaterialTheme.colorScheme.onBackground,
        maxLines = 2,
        overflow = TextOverflow.Ellipsis,
      )
      if (!article.source.isNullOrBlank()) {
        Text(
          article.source!!,
          style = MaterialTheme.typography.labelMedium,
          color = MaterialTheme.colorScheme.primary,
          maxLines = 1,
        )
      }
    }
    ArticleCoverImage(article, Modifier.size(64.dp))
  }
}

@Composable
private fun TagChip(text: String) {
  Box(
    modifier = Modifier
      .clip(RoundedCornerShape(6.dp))
      .background(MaterialTheme.colorScheme.secondaryContainer.copy(alpha = 0.6f))
      .padding(horizontal = 8.dp, vertical = 3.dp),
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
private fun ArticleCoverImage(article: ArticleCard, modifier: Modifier) {
  val imageUrl = article.coverImage?.trim()
    ?.takeIf { it.startsWith("https://") || it.startsWith("http://") }
  val palette = ArticleVisualPalettes.forArticle(article.id)

  Box(
    modifier = modifier.clip(RoundedCornerShape(10.dp)),
    contentAlignment = Alignment.Center,
  ) {
    if (imageUrl != null) {
      AsyncImage(
        model = imageUrl,
        contentDescription = "${article.displayTitle} 的封面图",
        contentScale = ContentScale.Crop,
        modifier = Modifier.fillMaxSize(),
      )
    } else {
      // 无封面时用品牌色渐变占位 + 书卷 icon
      Box(
        modifier = Modifier
          .fillMaxSize()
          .background(Brush.linearGradient(listOf(palette.start, palette.end))),
        contentAlignment = Alignment.Center,
      ) {
        Icon(
          Icons.Outlined.AutoStories,
          contentDescription = null,
          tint = MaterialTheme.colorScheme.onPrimary.copy(alpha = 0.7f),
          modifier = Modifier.size(22.dp),
        )
      }
    }
  }
}
