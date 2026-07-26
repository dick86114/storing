package com.idickies.storing.library

/** The library's card-first and compact scanning-friendly presentations. */
enum class ArticleListPresentationMode(val label: String) {
  CompactList("列表"),
  Grid("双列"),
  Card("卡片");

  companion object {
    val default: ArticleListPresentationMode = Card
  }
}
