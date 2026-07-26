package com.idickies.storing.ui.components

import androidx.compose.foundation.Image
import androidx.compose.foundation.layout.size
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Public
import androidx.compose.material3.Icon
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import coil3.compose.SubcomposeAsyncImage
import coil3.compose.SubcomposeAsyncImageContent
import com.idickies.storing.R
import java.net.URI

enum class ArticleSourceIconType { Wechat, Website, Globe }

data class ArticleSourceIcon(
  val type: ArticleSourceIconType,
  val faviconUrl: String? = null,
)

fun articleSourceIcon(source: String?, originalUrl: String?): ArticleSourceIcon {
  val isWechat = source?.contains("微信") == true || originalUrl?.contains("mp.weixin.qq.com", ignoreCase = true) == true
  if (isWechat) return ArticleSourceIcon(ArticleSourceIconType.Wechat)

  val host = originalUrl
    ?.takeIf { it.startsWith("https://") || it.startsWith("http://") }
    ?.let { runCatching { URI(it).host }.getOrNull() }
    ?.removePrefix("www.")
    ?.takeIf { it.isNotBlank() }
  return if (host == null) ArticleSourceIcon(ArticleSourceIconType.Globe)
  else ArticleSourceIcon(ArticleSourceIconType.Website, faviconUrl = "https://$host/favicon.ico")
}

/** Source identity shared by article cards and the reader action bar. */
@Composable
fun ArticleSourceIdentityIcon(
  source: String?,
  originalUrl: String?,
  tint: Color,
  modifier: Modifier = Modifier,
  size: Dp = 16.dp,
) {
  val identity = remember(source, originalUrl) { articleSourceIcon(source, originalUrl) }
  when (identity.type) {
    ArticleSourceIconType.Wechat -> Image(
      painter = painterResource(R.drawable.ic_source_wechat),
      contentDescription = "微信公众号来源",
      modifier = modifier.size(size),
    )
    ArticleSourceIconType.Website -> SubcomposeAsyncImage(
      model = identity.faviconUrl,
      contentDescription = "网站来源",
      modifier = modifier.size(size),
      loading = {
        Icon(Icons.Outlined.Public, contentDescription = "网页来源", tint = tint, modifier = Modifier.size(size))
      },
      error = {
        Icon(Icons.Outlined.Public, contentDescription = "网页来源", tint = tint, modifier = Modifier.size(size))
      },
      success = { SubcomposeAsyncImageContent() },
    )
    ArticleSourceIconType.Globe -> Icon(
      imageVector = Icons.Outlined.Public,
      contentDescription = "网页来源",
      modifier = modifier.size(size),
      tint = tint,
    )
  }
}
