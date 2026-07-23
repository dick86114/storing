package com.idickies.storing.library

/** The library's card-first and compact scanning-friendly presentations. */
enum class ArticleListPresentationMode(val label: String) {
  Card("卡片"),
  CompactList("列表");

  companion object {
    val default: ArticleListPresentationMode = Card
  }
}
