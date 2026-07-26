package com.idickies.storing.ui.components

import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.combinedClickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
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
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import coil3.compose.AsyncImage
import coil3.compose.SubcomposeAsyncImage
import coil3.compose.SubcomposeAsyncImageContent
import com.idickies.storing.R
import com.idickies.storing.library.ArticleCard

data class ArticleCardLayout(
  val coverAspectRatio: Float,
  val cardCornerRadius: androidx.compose.ui.unit.Dp,
  val coverCornerRadius: androidx.compose.ui.unit.Dp,
  val contentPadding: androidx.compose.ui.unit.Dp,
)

/** Full-card geometry: WeChat official-account cover plus the approved reading-card rhythm. */
val articleCardLayout = ArticleCardLayout(
  coverAspectRatio = 2.35f,
  cardCornerRadius = 24.dp,
  coverCornerRadius = 16.dp,
  contentPadding = 16.dp,
)

private val CompactThumbnailSize = 96.dp


private val gridArticleCardLayout = ArticleCardLayout(
  coverAspectRatio = 1.36f,
  cardCornerRadius = 18.dp,
  coverCornerRadius = 16.dp,
  contentPadding = 12.dp,
)


/** 文章卡片：封面图在上，标题/摘要/标签在下 */
@Composable
fun QiankunjieArticleCard(
  article: ArticleCard,
  onOpen: (Int) -> Unit,
  onLongPress: (ArticleCard) -> Unit = {},
  modifier: Modifier = Modifier,
) {
  val colors = MaterialTheme.colorScheme
  val cardShape = RoundedCornerShape(articleCardLayout.cardCornerRadius)

  Card(
    modifier = modifier
      .fillMaxWidth()
      .combinedClickable(onClick = { onOpen(article.id) }, onLongClick = { onLongPress(article) }),
    colors = CardDefaults.cardColors(containerColor = colors.surfaceVariant),
    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    shape = cardShape,
    border = androidx.compose.foundation.BorderStroke(1.dp, colors.outline.copy(alpha = 0.76f)),
  ) {
    Column {
      ArticleThumbnail(
        article = article,
        modifier = Modifier
          .fillMaxWidth()
          .aspectRatio(articleCardLayout.coverAspectRatio),
        shape = RoundedCornerShape(
          topStart = articleCardLayout.coverCornerRadius,
          topEnd = articleCardLayout.coverCornerRadius,
        ),
      )
      Column(modifier = Modifier.padding(articleCardLayout.contentPadding)) {
        ArticleMetadata(article, color = colors.onSurfaceVariant)
        Text(
          article.displayTitle,
          style = MaterialTheme.typography.titleLarge,
          color = colors.onSurface,
          modifier = Modifier.padding(top = 10.dp),
          maxLines = 2,
          overflow = TextOverflow.Ellipsis,
        )
        article.aiSummary?.takeIf { it.isNotBlank() }?.let { summary ->
          Text(
            summary,
            style = MaterialTheme.typography.bodyMedium,
            color = colors.onSurfaceVariant,
            modifier = Modifier.padding(top = 8.dp),
            maxLines = 2,
            overflow = TextOverflow.Ellipsis,
          )
        }
        if (article.aiTags.isNotEmpty()) {
          Row(
            modifier = Modifier.padding(top = 14.dp).fillMaxWidth(),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
            verticalAlignment = Alignment.CenterVertically,
          ) {
            article.aiTags.take(3).forEachIndexed { index, tag ->
              TagPill(text = tag, colorIndex = index)
            }
            if (article.aiTags.size > 3) {
              Text(
                "+${article.aiTags.size - 3}",
                style = MaterialTheme.typography.labelMedium,
                color = colors.onSurfaceVariant,
              )
            }
          }
        }
      }
    }
  }
}

/** 双列布局：图二所示的封面、来源、标题与单个标签的紧凑卡片。 */
@Composable
fun QiankunjieGridArticleCard(
  article: ArticleCard,
  onOpen: (Int) -> Unit,
  onLongPress: (ArticleCard) -> Unit = {},
  modifier: Modifier = Modifier,
) {
  val colors = MaterialTheme.colorScheme
  Card(
    modifier = modifier
      .fillMaxWidth()
      .combinedClickable(onClick = { onOpen(article.id) }, onLongClick = { onLongPress(article) }),
    colors = CardDefaults.cardColors(containerColor = colors.surfaceVariant),
    elevation = CardDefaults.cardElevation(defaultElevation = 0.dp),
    shape = RoundedCornerShape(gridArticleCardLayout.cardCornerRadius),
    border = androidx.compose.foundation.BorderStroke(1.dp, colors.outline.copy(alpha = 0.68f)),
  ) {
    Column {
      ArticleThumbnail(
        article = article,
        modifier = Modifier.fillMaxWidth().aspectRatio(gridArticleCardLayout.coverAspectRatio),
        shape = RoundedCornerShape(
          topStart = gridArticleCardLayout.coverCornerRadius,
          topEnd = gridArticleCardLayout.coverCornerRadius,
        ),
      )
      Column(
        modifier = Modifier.padding(gridArticleCardLayout.contentPadding),
        verticalArrangement = Arrangement.spacedBy(8.dp),
      ) {
        ArticleMetadata(article, color = colors.onSurfaceVariant)
        Text(
          article.displayTitle,
          style = MaterialTheme.typography.titleMedium,
          color = colors.onSurface,
          maxLines = 3,
          overflow = TextOverflow.Ellipsis,
        )
        article.aiTags.firstOrNull()?.takeIf { it.isNotBlank() }?.let { TagPill(text = it, colorIndex = 0) }
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
    border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outlineVariant),
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
private fun ArticleMetadata(article: ArticleCard, color: androidx.compose.ui.graphics.Color = MaterialTheme.colorScheme.primary) {
  Row(
    verticalAlignment = Alignment.CenterVertically,
    horizontalArrangement = Arrangement.spacedBy(6.dp),
  ) {
    if (!article.source.isNullOrBlank()) {
      ArticleSourceIdentityIcon(article = article, tint = color)
      Text(
        article.source!!,
        style = MaterialTheme.typography.labelMedium,
        color = color,
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
private fun ArticleSourceIdentityIcon(article: ArticleCard, tint: androidx.compose.ui.graphics.Color) {
  val identity = remember(article.source, article.originalUrl) { articleSourceIcon(article.source, article.originalUrl) }
  when (identity.type) {
    ArticleSourceIconType.Wechat -> Image(
      painter = painterResource(R.drawable.ic_source_wechat),
      contentDescription = "微信公众号来源",
      modifier = Modifier.size(16.dp),
    )
    ArticleSourceIconType.Website -> SubcomposeAsyncImage(
      model = identity.faviconUrl,
      contentDescription = "网站来源",
      modifier = Modifier.size(16.dp),
      loading = {
        Icon(Icons.Outlined.Public, contentDescription = null, tint = tint, modifier = Modifier.size(16.dp))
      },
      error = {
        Icon(Icons.Outlined.Public, contentDescription = "网页来源", tint = tint, modifier = Modifier.size(16.dp))
      },
      success = { SubcomposeAsyncImageContent() },
    )
    ArticleSourceIconType.Globe -> Icon(
      imageVector = Icons.Outlined.Public,
      contentDescription = "网页来源",
      modifier = Modifier.size(16.dp),
      tint = tint,
    )
  }
}

@Composable
private fun TagPill(text: String, colorIndex: Int) {
  val colors = MaterialTheme.colorScheme
  val (containerColor, contentColor) = when (colorIndex % 3) {
    1 -> colors.primaryContainer to colors.onPrimaryContainer
    2 -> colors.tertiaryContainer to colors.onTertiaryContainer
    else -> colors.secondaryContainer to colors.onSecondaryContainer
  }
  Box(
    modifier = Modifier
      .clip(RoundedCornerShape(99.dp))
      .background(containerColor)
      .padding(horizontal = 10.dp, vertical = 3.dp),
    contentAlignment = Alignment.Center,
  ) {
    Text(
      text,
      style = MaterialTheme.typography.labelMedium,
      color = contentColor,
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
