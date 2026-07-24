package com.idickies.storing.library

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class ArticleCard(
  val id: Int,
  val title: String? = null,
  val author: String? = null,
  val source: String? = null,
  @SerialName("originalUrl") val originalUrl: String? = null,
  @SerialName("publicId") val publicId: String? = null,
  @SerialName("coverImage") val coverImage: String? = null,
  @SerialName("aiSummary") val aiSummary: String? = null,
  @SerialName("aiCategory") val aiCategory: String? = null,
  @SerialName("aiTags") val aiTags: List<String> = emptyList(),
  @SerialName("isFavorited") val isFavorited: Boolean = false,
  @SerialName("isArchived") val isArchived: Boolean = false,
  @SerialName("isPublished") val isPublished: Boolean = false,
) {
  val displayTitle: String get() = title?.trim().takeUnless { it.isNullOrEmpty() }
    ?: source?.trim().takeUnless { it.isNullOrEmpty() }
    ?: "未命名文章"
}

@Serializable
data class ArticleSource(
  val source: String,
  val count: Int,
  @SerialName("latestCreatedAt") val latestCreatedAt: String? = null,
)

@Serializable
data class ArticleListResponse(
  val articles: List<ArticleCard> = emptyList(),
  val total: Int = 0,
  val page: Int = 1,
  val perPage: Int = 20,
  val totalPages: Int = 0,
)

@Serializable
data class ArticleDetail(
  val id: Int,
  val title: String? = null,
  val author: String? = null,
  val source: String? = null,
  @SerialName("originalUrl") val originalUrl: String? = null,
  @SerialName("publicId") val publicId: String? = null,
  @SerialName("coverImage") val coverImage: String? = null,
  @SerialName("aiSummary") val aiSummary: String? = null,
  @SerialName("aiCategory") val aiCategory: String? = null,
  @SerialName("aiTags") val aiTags: List<String> = emptyList(),
  @SerialName("isFavorited") val isFavorited: Boolean = false,
  @SerialName("isArchived") val isArchived: Boolean = false,
  @SerialName("isPublished") val isPublished: Boolean = false,
  @SerialName("contentHtml") val contentHtml: String? = null,
  @SerialName("contentMd") val contentMd: String? = null,
) {
  val displayTitle: String get() = title?.trim().takeUnless { it.isNullOrEmpty() } ?: source.orEmpty().ifBlank { "未命名文章" }
}

@Serializable
data class ToggleFavoriteResponse(
  @SerialName("articleId") val articleId: Int,
  @SerialName("isFavorited") val isFavorited: Boolean,
)

@Serializable
data class ArchiveResponse(
  @SerialName("articleId") val articleId: Int,
  @SerialName("isArchived") val isArchived: Boolean,
)


@Serializable
data class PublicArticleResponse(
  val article: ArticleDetail,
)


@Serializable
data class PublicationResponse(
  val article: ArticleDetail,
  @SerialName("publicUrl") val publicUrl: String? = null,
)


@Serializable
data class ArticleRefetchResponse(
  @SerialName("articleId") val articleId: Int,
  @SerialName("contentHtml") val contentHtml: Boolean = false,
  @SerialName("contentHtmlMobile") val contentHtmlMobile: Boolean = false,
  @SerialName("contentMd") val contentMd: Boolean = false,
  @SerialName("coverImage") val coverImage: String? = null,
)

@Serializable
data class ArticleRegenerateAiResponse(
  @SerialName("articleId") val articleId: Int,
  val ok: Boolean,
)
