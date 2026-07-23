package com.idickies.storing.library

import com.idickies.storing.network.ArticleApi
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ArticleRepository @Inject constructor(private val api: ArticleApi) {
  suspend fun list(view: LibraryView, page: Int = 1) = api.articles(view.apiValue, page)
  suspend fun search(query: String, page: Int = 1) = api.search(query, page)
  suspend fun detail(id: Int) = api.article(id)
  suspend fun toggleFavorite(id: Int) = api.toggleFavorite(id)
  suspend fun toggleArchive(id: Int, archived: Boolean) = if (archived) api.unarchive(id) else api.archive(id)
  suspend fun delete(id: Int) = api.delete(id)
}

enum class LibraryView(val apiValue: String, val label: String) {
  Inbox("inbox", "收件箱"),
  Favorites("favorites", "收藏"),
  Archive("archive", "归档"),
}
