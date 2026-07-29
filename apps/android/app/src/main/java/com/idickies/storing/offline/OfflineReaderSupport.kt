package com.idickies.storing.offline

import com.idickies.storing.library.ArticleCard
import com.idickies.storing.library.ArticleDetail
import java.net.URI

private const val OFFLINE_READER_SCHEME = "https"
private const val OFFLINE_READER_HOST = "offline.storing.local"
private val OFFLINE_ASSET_FILE_NAME = Regex("[A-Za-z0-9._-]+")
private val OFFLINE_ASSET_PATH = Regex("^/articles/(\\d+)/images/([A-Za-z0-9._-]+)$")

data class OfflineReaderContent(
  val article: OfflineArticle,
  val contentHtml: String,
)

data class OfflineAssetRequest(
  val articleId: Int,
  val fileName: String,
)

internal fun offlineDocumentBaseUrl(articleId: Int): String =
  "$OFFLINE_READER_SCHEME://$OFFLINE_READER_HOST/articles/$articleId/"

internal fun offlineAssetUrl(articleId: Int, fileName: String): String {
  require(OFFLINE_ASSET_FILE_NAME.matches(fileName)) { "离线资源文件名无效" }
  return "${offlineDocumentBaseUrl(articleId)}images/$fileName"
}

/** Parses only the app-owned virtual offline resource URLs; all others are rejected. */
internal fun parseOfflineAssetRequest(url: String): OfflineAssetRequest? {
  val uri = runCatching { URI(url) }.getOrNull() ?: return null
  if (
    uri.scheme != OFFLINE_READER_SCHEME ||
    uri.host != OFFLINE_READER_HOST ||
    uri.port != -1 ||
    uri.query != null ||
    uri.fragment != null
  ) return null
  val match = OFFLINE_ASSET_PATH.matchEntire(uri.rawPath ?: return null) ?: return null
  return OfflineAssetRequest(articleId = match.groupValues[1].toIntOrNull() ?: return null, fileName = match.groupValues[2])
}

/** Creates a reader model from a local copy, retaining richer metadata when the library card is available. */
internal fun offlineReaderDetail(card: ArticleCard?, offline: OfflineReaderContent): ArticleDetail {
  val saved = offline.article
  return if (card == null) {
    ArticleDetail(
      id = saved.articleId,
      title = saved.title,
      source = saved.source,
      author = saved.author,
      contentHtml = offline.contentHtml,
    )
  } else {
    ArticleDetail(
      id = card.id,
      title = card.title,
      source = card.source,
      author = card.author,
      originalUrl = card.originalUrl,
      publicId = card.publicId,
      coverImage = card.coverImage,
      aiSummary = card.aiSummary,
      aiCategory = card.aiCategory,
      aiTags = card.aiTags,
      isFavorited = card.isFavorited,
      isArchived = card.isArchived,
      isPublished = card.isPublished,
      contentHtml = offline.contentHtml,
    )
  }
}
