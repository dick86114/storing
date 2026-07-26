package com.idickies.storing.ui.components

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
