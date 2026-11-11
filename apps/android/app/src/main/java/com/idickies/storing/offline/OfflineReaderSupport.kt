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
  val detail: ArticleDetail? = null,
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

/**
 * 从本地正文构建阅读模型。新版缓存会保存完整详情；
 * 列表卡片仍用于覆盖当前收藏、归档等可能已变化的轻量状态。
 */
internal fun offlineReaderDetail(card: ArticleCard?, offline: OfflineReaderContent): ArticleDetail {
  val saved = offline.article
  val cached = offline.detail
  if (cached != null) {
    return cached.copy(
      title = card?.title ?: cached.title,
      author = card?.author ?: cached.author,
      source = card?.source ?: cached.source,
      originalUrl = card?.originalUrl ?: cached.originalUrl,
      publicId = card?.publicId ?: cached.publicId,
      coverImage = card?.coverImage ?: cached.coverImage,
      aiSummary = card?.aiSummary ?: cached.aiSummary,
      aiCategory = card?.aiCategory ?: cached.aiCategory,
      aiTags = card?.aiTags?.takeIf { it.isNotEmpty() } ?: cached.aiTags,
      aiStatus = card?.aiStatus ?: cached.aiStatus,
      aiErrorCode = card?.aiErrorCode ?: cached.aiErrorCode,
      aiErrorMessage = card?.aiErrorMessage ?: cached.aiErrorMessage,
      aiModel = card?.aiModel ?: cached.aiModel,
      aiTotalTokens = card?.aiTotalTokens ?: cached.aiTotalTokens,
      category = card?.category ?: cached.category,
      categoryResult = card?.categoryResult ?: cached.categoryResult,
      isFavorited = card?.isFavorited ?: cached.isFavorited,
      isArchived = card?.isArchived ?: cached.isArchived,
      isPublished = card?.isPublished ?: cached.isPublished,
      contentHtml = offline.contentHtml,
      contentMd = null,
    )
  }
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
