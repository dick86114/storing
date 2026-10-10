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

fun BulkToolbarAction.toBulkArticleAction(): BulkArticleAction = when (this) {
  BulkToolbarAction.Favorite -> BulkArticleAction.Favorite
  BulkToolbarAction.Unfavorite -> BulkArticleAction.Unfavorite
  BulkToolbarAction.Archive -> BulkArticleAction.Archive
  BulkToolbarAction.Unarchive -> BulkArticleAction.Unarchive
  BulkToolbarAction.Delete -> BulkArticleAction.Delete
  BulkToolbarAction.PermanentDelete -> BulkArticleAction.PermanentDelete
  BulkToolbarAction.Publish -> BulkArticleAction.Publish
  BulkToolbarAction.Unpublish -> BulkArticleAction.Unpublish
  BulkToolbarAction.SetCategory -> error("设置分类使用专用端点")
  BulkToolbarAction.ReclassifyCategory -> error("重判分类使用专用端点")
  BulkToolbarAction.GenerateAi -> error("生成 AI 使用专用端点")
  BulkToolbarAction.ExportZip -> error("导出 ZIP 使用专用端点")
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

data class BulkActionConfirmation(
  val title: String,
  val message: String,
  val isDanger: Boolean,
)

fun bulkActionConfirmation(action: BulkToolbarAction, selectedCount: Int): BulkActionConfirmation {
  val noun = "选中的 $selectedCount 篇文章"
  val detail = when (action) {
    BulkToolbarAction.Favorite -> "将把${noun}统一标记为收藏。"
    BulkToolbarAction.Unfavorite -> "将把${noun}从收藏中移除。"
    BulkToolbarAction.Archive -> "未归档文章会进入「待整理」，并按设置触发 AI 任务。"
    BulkToolbarAction.Unarchive -> "所选文章将全部回到收件箱。"
    BulkToolbarAction.Delete -> "将从当前账号移除${noun}。"
    BulkToolbarAction.PermanentDelete -> "共享原文只会在没有其他用户引用时物理删除，此操作不可恢复。"
    BulkToolbarAction.Publish -> "未归档文章会自动归档，并生成游客可见的公开链接。"
    BulkToolbarAction.Unpublish -> "公开链接将立即失效；归档状态和公开 ID 会保留。"
    BulkToolbarAction.SetCategory -> "确认后将打开分类选择弹窗。"
    BulkToolbarAction.ReclassifyCategory -> "仅已归档且未被你确认过的文章会重新进入 AI 分类。"
    BulkToolbarAction.GenerateAi -> "将按当前 AI 配置为所选文章排队生成摘要和标签。"
    BulkToolbarAction.ExportZip -> "系统会在后台生成 Markdown 压缩包，完成后可直接下载。"
  }
  val title = when (action) {
    BulkToolbarAction.Favorite -> "确认批量收藏？"
    BulkToolbarAction.Unfavorite -> "确认批量取消收藏？"
    BulkToolbarAction.Archive -> "确认批量归档？"
    BulkToolbarAction.Unarchive -> "确认批量移回收件箱？"
    BulkToolbarAction.Delete -> "确认批量删除？"
    BulkToolbarAction.PermanentDelete -> "确认批量彻底删除？"
    BulkToolbarAction.Publish -> "确认批量发布？"
    BulkToolbarAction.Unpublish -> "确认批量取消发布？"
    BulkToolbarAction.SetCategory -> "确认批量设置分类？"
    BulkToolbarAction.ReclassifyCategory -> "确认批量重判分类？"
    BulkToolbarAction.GenerateAi -> "确认批量生成 AI？"
    BulkToolbarAction.ExportZip -> "确认批量导出 ZIP？"
  }
  return BulkActionConfirmation(title, "已选择 $selectedCount 篇文章。$detail", action == BulkToolbarAction.Delete || action == BulkToolbarAction.PermanentDelete)
}

data class BulkUiState(
  val runningAction: BulkToolbarAction? = null,
  val selectedIds: Set<Int> = emptySet(),
  val result: NativeBulkResult? = null,
  val exportJob: ArticleBulkExportJob? = null,
  val downloadingExport: Boolean = false,
  val error: String? = null,
)

sealed interface BulkUiEvent {
  data class Start(val action: BulkToolbarAction) : BulkUiEvent
  data class Success(val action: BulkToolbarAction, val result: NativeBulkResult) : BulkUiEvent
  data class ExportUpdated(val job: ArticleBulkExportJob) : BulkUiEvent
  data class Failure(val message: String) : BulkUiEvent
}

object BulkUiStateReducer {
  fun apply(current: BulkUiState, event: BulkUiEvent): BulkUiState = when (event) {
    is BulkUiEvent.Start -> if (current.runningAction != null) current else current.copy(
      runningAction = event.action,
      error = null,
      result = null,
    )
    is BulkUiEvent.Success -> current.copy(
      runningAction = null,
      result = event.result,
      error = null,
    )
    is BulkUiEvent.ExportUpdated -> current.copy(exportJob = event.job, downloadingExport = event.job.status == ArticleBulkExportStatus.Running)
    is BulkUiEvent.Failure -> current.copy(
      runningAction = null,
      error = event.message,
    )
  }
}
