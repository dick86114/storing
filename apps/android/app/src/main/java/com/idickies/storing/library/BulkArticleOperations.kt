package com.idickies.storing.library

import java.io.Serializable
import kotlinx.serialization.SerialName

const val BULK_ARTICLE_ACTION_LIMIT = 200

@kotlinx.serialization.Serializable
enum class BulkArticleAction(val apiValue: String) : Serializable {
  @SerialName("favorite") Favorite("favorite"),
  @SerialName("unfavorite") Unfavorite("unfavorite"),
  @SerialName("archive") Archive("archive"),
  @SerialName("unarchive") Unarchive("unarchive"),
  @SerialName("delete") Delete("delete"),
  @SerialName("permanent_delete") PermanentDelete("permanent_delete"),
  @SerialName("publish") Publish("publish"),
  @SerialName("unpublish") Unpublish("unpublish"),
}

enum class BulkToolbarAction {
  Favorite,
  Unfavorite,
  Archive,
  Unarchive,
  Delete,
  PermanentDelete,
  Publish,
  Unpublish,
  SetCategory,
  ReclassifyCategory,
  GenerateAi,
  ExportZip,
}

fun bulkToolbarActions(view: LibraryView): List<BulkToolbarAction> = when (view) {
  LibraryView.Inbox -> listOf(
    BulkToolbarAction.Favorite,
    BulkToolbarAction.Archive,
    BulkToolbarAction.Delete,
    BulkToolbarAction.PermanentDelete,
    BulkToolbarAction.GenerateAi,
    BulkToolbarAction.Publish,
    BulkToolbarAction.ExportZip,
  )
  LibraryView.Favorites -> listOf(
    BulkToolbarAction.Unfavorite,
    BulkToolbarAction.Archive,
    BulkToolbarAction.Delete,
    BulkToolbarAction.PermanentDelete,
    BulkToolbarAction.GenerateAi,
    BulkToolbarAction.Publish,
    BulkToolbarAction.ExportZip,
  )
  LibraryView.Archive -> listOf(
    BulkToolbarAction.Favorite,
    BulkToolbarAction.Unfavorite,
    BulkToolbarAction.Unarchive,
    BulkToolbarAction.SetCategory,
    BulkToolbarAction.ReclassifyCategory,
    BulkToolbarAction.GenerateAi,
    BulkToolbarAction.Delete,
    BulkToolbarAction.PermanentDelete,
    BulkToolbarAction.Publish,
    BulkToolbarAction.Unpublish,
    BulkToolbarAction.ExportZip,
  )
  LibraryView.Published -> listOf(
    BulkToolbarAction.Unpublish,
    BulkToolbarAction.Delete,
    BulkToolbarAction.PermanentDelete,
    BulkToolbarAction.ExportZip,
  )
}

fun validatedBulkArticleIds(ids: Collection<Int>): List<Int> {
  ids.forEach { id ->
    require(id > 0) { "文章 ID 必须为正整数" }
  }
  val uniqueIds = ids.distinct()
  require(uniqueIds.size <= BULK_ARTICLE_ACTION_LIMIT) {
    "单次批量最多处理 $BULK_ARTICLE_ACTION_LIMIT 篇文章"
  }
  return uniqueIds
}

data class NativeBulkResult(
  val requestedCount: Int,
  val succeededCount: Int,
  val skippedCount: Int,
  val issues: List<ArticleBulkIssue>,
  val publications: List<ArticlePublicationLink>,
) {
  companion object {
    fun from(result: ArticleBulkActionResult) = NativeBulkResult(
      requestedCount = result.requestedCount,
      succeededCount = result.succeededIds.size,
      skippedCount = result.skipped.size,
      issues = result.skipped + result.failed,
      publications = result.publications,
    )

    fun from(result: ArticleBulkAiResult) = NativeBulkResult(
      requestedCount = result.requestedCount,
      succeededCount = result.queuedIds.size,
      skippedCount = result.alreadyQueuedIds.size,
      issues = result.failed,
      publications = emptyList(),
    )
  }
}

fun removeBulkSelection(selected: Set<Int>, succeededIds: Collection<Int>): Set<Int> =
  selected - succeededIds.toSet()

fun removeMissingBulkSelection(selected: Set<Int>, availableIds: Collection<Int>): Set<Int> =
  selected intersect availableIds.toSet()
