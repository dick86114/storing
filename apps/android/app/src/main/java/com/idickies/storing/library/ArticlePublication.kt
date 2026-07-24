package com.idickies.storing.library

enum class PublicationAction(
  val label: String,
  val confirmationTitle: String,
  val confirmationMessage: String,
) {
  Publish(
    label = "发布文章",
    confirmationTitle = "公开发布这篇文章？",
    confirmationMessage = "发布后，任何持有公开链接的人都可以阅读这篇文章。",
  ),
  Unpublish(
    label = "取消发布",
    confirmationTitle = "取消公开发布？",
    confirmationMessage = "取消后，公开链接将不再展示这篇文章；你的个人资料库内容不会被删除。",
  ),
}

fun publicationAction(isPublished: Boolean): PublicationAction =
  if (isPublished) PublicationAction.Unpublish else PublicationAction.Publish

/** Public-feed cards are readable but never carry actions for another user's private library. */
fun canManageArticle(isAuthenticated: Boolean, view: LibraryView): Boolean =
  isAuthenticated && view != LibraryView.Published
