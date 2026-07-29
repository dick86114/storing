package com.idickies.storing.library

import com.idickies.storing.auth.SessionStore
import com.idickies.storing.database.ArticleCacheDao
import com.idickies.storing.database.toCached
import com.idickies.storing.network.ArticleApi
import com.idickies.storing.network.ArticleCounts
import com.idickies.storing.network.PermanentDeleteResponse
import javax.inject.Inject
import javax.inject.Singleton

data class ArticleListLoad(val response: ArticleListResponse, val fromCache: Boolean)

@Singleton
class ArticleRepository @Inject constructor(
  private val api: ArticleApi,
  private val sessionStore: SessionStore,
  private val cacheDao: ArticleCacheDao,
) {
  suspend fun list(
    view: LibraryView,
    page: Int = 1,
    sort: LibrarySort = LibrarySort.defaultFor(view),
    categories: List<String>? = null,
    order: String = "desc",
  ): ArticleListLoad {
    val userId = sessionStore.read()?.userId
    val canUseViewCache = sort == LibrarySort.defaultFor(view) && categories.isNullOrEmpty() && order == "desc"
    return runCatching { api.articles(view.apiValue, page, sort = sort.apiValue, order = order, categories = categories) }
      .onSuccess { response ->
        if (userId != null && page == 1 && canUseViewCache) {
          cacheDao.replace(userId, view.apiValue, response.articles.map { it.toCached(userId, view.apiValue) })
        }
      }
      .fold(
        onSuccess = { ArticleListLoad(it, fromCache = false) },
        onFailure = { error ->
          if (!canUseViewCache) throw error
          val cached = if (userId == null) emptyList() else cacheDao.cards(userId, view.apiValue).map { it.toArticleCard() }
          if (cached.isEmpty()) throw error
          ArticleListLoad(ArticleListResponse(articles = cached, total = cached.size, page = 1, perPage = cached.size, totalPages = 1), fromCache = true)
        },
      )
  }

  suspend fun search(query: String, page: Int = 1) = api.search(query, page)
  suspend fun sources() = api.sources()
  suspend fun detail(id: Int, publicId: String? = null) =
    publicId?.let { api.publication(it).article } ?: api.article(id)
  suspend fun toggleFavorite(id: Int) = api.toggleFavorite(id)
  suspend fun toggleArchive(id: Int, archived: Boolean) = if (archived) api.unarchive(id) else api.archive(id)
  suspend fun togglePublication(id: Int, published: Boolean) = if (published) api.unpublish(id) else api.publish(id)
  suspend fun refetch(id: Int) = api.refetch(id)
  suspend fun regenerateAi(id: Int) = api.regenerateAi(id)
  suspend fun delete(id: Int) = api.delete(id)
  suspend fun deletePermanent(id: Int): PermanentDeleteResponse = api.deletePermanent(id)
  suspend fun counts(): ArticleCounts = api.counts()
}

enum class LibraryView(val apiValue: String, val label: String, val shortLabel: String) {
  Inbox("inbox", "收件箱", "收件箱"),
  Favorites("favorites", "收藏", "收藏"),
  Archive("archive", "归档", "归档"),
  Published("published", "发布", "发布"),
}
