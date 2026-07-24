package com.idickies.storing.network

import kotlinx.serialization.Serializable

@Serializable
data class ArticleCounts(
  val inbox: Int = 0,
  val favorites: Int = 0,
  val archive: Int = 0,
  val published: Int = 0,
)

@Serializable
data class PermanentDeleteResponse(
  @kotlinx.serialization.SerialName("articleId") val articleId: Int,
  val deleted: Boolean = true,
  val scope: String = "metadata",
)
