package com.idickies.storing.library

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import com.idickies.storing.library.ArticleCard
import com.idickies.storing.network.ArticleCounts
import com.idickies.storing.reader.ReadingPositionRepository
import com.idickies.storing.offline.OfflineDownloadManager
import javax.inject.Inject

private const val SEARCH_DEBOUNCE_MILLIS = 350L

private data class LibraryRequest(
  val view: LibraryView,
  val query: String,
  val sort: LibrarySort,
  val sortOrder: String,
  val archiveSource: ArchiveSourceFilter,
)

data class LibraryUiState(
  val view: LibraryView = LibraryView.Inbox,
  val articles: List<ArticleCard> = emptyList(),
  val loading: Boolean = true,
  val refreshing: Boolean = false,
  val loadingMore: Boolean = false,
  val searchPending: Boolean = false,
  val error: String? = null,
  val loadMoreError: String? = null,
  val fromCache: Boolean = false,
  val searchQuery: String = "",
  val sort: LibrarySort = LibrarySort.defaultFor(LibraryView.Inbox),
  val sortOrder: String = "desc",
  val archiveSource: ArchiveSourceFilter = ArchiveSourceFilter.All,
  val archiveSources: List<ArticleSource> = emptyList(),
  val archiveSourcesLoading: Boolean = false,
  val page: Int = 1,
  val totalPages: Int = 0,
  val detail: ArticleDetail? = null,
  val loadingDetail: Boolean = false,
  val detailError: String? = null,
  val detailRefreshing: Boolean = false,
  val detailRefreshVersion: Int = 0,
  val processingAction: ArticleProcessingAction? = null,
  val processingError: String? = null,
  val counts: ArticleCounts? = null,
  val badgeCounts: Map<LibraryView, Int> = emptyMap(),
  val permanentDeleting: Boolean = false,
  val savedReadingPosition: Float? = null,
  val isOfflineAvailable: Boolean = false,
  val downloadingOffline: Boolean = false,
  val offlineError: String? = null,
) {
  val hasMore: Boolean get() = LibraryPaging(page = page, totalPages = totalPages).hasMore
}

@HiltViewModel
class LibraryViewModel @Inject constructor(
  private val repository: ArticleRepository,
  private val readingPositionRepository: ReadingPositionRepository,
  private val offlineDownloadManager: OfflineDownloadManager,
) : ViewModel() {
  private val mutableState = MutableStateFlow(LibraryUiState())
  val state = mutableState.asStateFlow()

  private var listLoadJob: Job? = null
  private var searchDebounceJob: Job? = null
  private var loadMoreJob: Job? = null
  private var sourceLoadJob: Job? = null
  private val lastSeenCounts = mutableMapOf<LibraryView, Int>()

  init {
    loadInitial()
    loadCounts()
  }

  fun select(view: LibraryView) {
    if (view == mutableState.value.view && mutableState.value.searchQuery.isEmpty()) return
    searchDebounceJob?.cancel()
    sourceLoadJob?.cancel()
    mutableState.update {
      it.copy(
        view = view,
        searchQuery = "",
        sort = LibrarySort.defaultFor(view),
        sortOrder = "desc",
        archiveSource = ArchiveSourceFilter.All,
        archiveSourcesLoading = false,
        articles = emptyList(),
        page = 1,
        totalPages = 0,
        fromCache = false,
        searchPending = false,
        loadMoreError = null,
      )
    }
    markViewSeen(view)
    loadInitial()
    if (view == LibraryView.Archive) loadArchiveSources()
  }

  /** 标记某个视图已查看，清除该视图的新增 badge */
  fun markViewSeen(view: LibraryView) {
    val counts = mutableState.value.counts ?: return
    val current = when (view) {
      LibraryView.Inbox -> counts.inbox
      LibraryView.Favorites -> counts.favorites
      LibraryView.Archive -> counts.archive
      LibraryView.Published -> counts.published
    }
    if (lastSeenCounts[view] != current) {
      lastSeenCounts[view] = current
      mutableState.update { it.copy(badgeCounts = computeBadgeCounts(counts)) }
    }
  }

  fun refresh() {
    searchDebounceJob?.cancel()
    loadInitial(refreshing = true)
    if (ArchiveSourceFilter.isAvailableFor(mutableState.value.view, mutableState.value.searchQuery)) loadArchiveSources()
    loadCounts()
  }

  fun selectArchiveSource(filter: ArchiveSourceFilter) {
    val snapshot = mutableState.value
    if (!ArchiveSourceFilter.isAvailableFor(snapshot.view, snapshot.searchQuery) || filter == snapshot.archiveSource) return
    mutableState.update {
      it.copy(
        archiveSource = filter,
        articles = emptyList(),
        page = 1,
        totalPages = 0,
        fromCache = false,
        loadMoreError = null,
      )
    }
    loadInitial()
  }

  fun toggleSortOrder() {
    val snapshot = mutableState.value
    mutableState.update {
      it.copy(
        sortOrder = if (it.sortOrder == "desc") "asc" else "desc",
        articles = emptyList(),
        page = 1,
        totalPages = 0,
        fromCache = false,
        loadMoreError = null,
      )
    }
    loadInitial()
  }

  fun resetSort() {
    val snapshot = mutableState.value
    val defaultSort = LibrarySort.defaultFor(snapshot.view)
    if (snapshot.searchQuery.isNotBlank() || (snapshot.sort == defaultSort && snapshot.sortOrder == "desc")) return
    mutableState.update {
      it.copy(
        sort = defaultSort,
        sortOrder = "desc",
        articles = emptyList(),
        page = 1,
        totalPages = 0,
        fromCache = false,
        loadMoreError = null,
      )
    }
    loadInitial()
  }

  fun selectSort(sort: LibrarySort) {
    val snapshot = mutableState.value
    if (snapshot.searchQuery.isNotBlank() || sort !in LibrarySort.availableFor(snapshot.view) || sort == snapshot.sort) return
    mutableState.update {
      it.copy(
        sort = sort,
        sortOrder = "desc",
        articles = emptyList(),
        page = 1,
        totalPages = 0,
        fromCache = false,
        loadMoreError = null,
      )
    }
    loadInitial()
  }

  fun search(query: String) {
    searchDebounceJob?.cancel()
    if (query.isNotBlank()) sourceLoadJob?.cancel()
    mutableState.update {
      it.copy(
        searchQuery = query,
        articles = emptyList(),
        page = 1,
        totalPages = 0,
        loading = query.isNotBlank(),
        refreshing = false,
        loadingMore = false,
        searchPending = query.isNotBlank(),
        error = null,
        loadMoreError = null,
        fromCache = false,
        archiveSourcesLoading = if (query.isBlank()) it.archiveSourcesLoading else false,
      )
    }
    if (query.isBlank()) {
      loadInitial()
      if (mutableState.value.view == LibraryView.Archive) loadArchiveSources()
      return
    }
    searchDebounceJob = viewModelScope.launch {
      delay(SEARCH_DEBOUNCE_MILLIS)
      loadInitial()
    }
  }

  fun loadMore() {
    val snapshot = mutableState.value
    if (snapshot.loading || snapshot.refreshing || snapshot.loadingMore || snapshot.fromCache || !snapshot.hasMore) return

    val request = snapshot.toRequest()
    val nextPage = snapshot.page + 1
    mutableState.update { it.copy(loadingMore = true, loadMoreError = null) }
    loadMoreJob = viewModelScope.launch {
      try {
        val result = loadPage(request, nextPage)
        if (!matches(request) || mutableState.value.page != snapshot.page) return@launch
        mutableState.update {
          it.copy(
            articles = appendUniqueArticles(it.articles, result.response.articles),
            page = result.response.page,
            totalPages = result.response.totalPages,
            loadingMore = false,
            loadMoreError = null,
            fromCache = false,
          )
        }
      } catch (error: CancellationException) {
        throw error
      } catch (error: Throwable) {
        if (matches(request)) {
          mutableState.update { it.copy(loadingMore = false, loadMoreError = error.message ?: "加载更多文章失败") }
        }
      }
    }
  }

  private fun loadInitial(refreshing: Boolean = false) {
    listLoadJob?.cancel()
    loadMoreJob?.cancel()
    val request = mutableState.value.toRequest()
    listLoadJob = viewModelScope.launch {
      mutableState.update {
        it.copy(
          loading = !refreshing,
          refreshing = refreshing,
          loadingMore = false,
          searchPending = false,
          error = null,
          loadMoreError = null,
        )
      }
      try {
        val result = loadPage(request, page = 1)
        if (!matches(request)) return@launch
        mutableState.update {
          it.copy(
            articles = result.response.articles,
            page = result.response.page,
            totalPages = result.response.totalPages,
            fromCache = result.fromCache,
            loading = false,
            refreshing = false,
          )
        }
      } catch (error: CancellationException) {
        throw error
      } catch (error: Throwable) {
        if (matches(request)) {
          mutableState.update {
            it.copy(
              loading = false,
              refreshing = false,
              error = error.message ?: "加载文章失败",
            )
          }
        }
      }
    }
  }

  private suspend fun loadPage(request: LibraryRequest, page: Int): ArticleListLoad =
    if (request.query.isBlank()) repository.list(request.view, page, request.sort, request.archiveSource.category, request.sortOrder)
    else ArticleListLoad(repository.search(request.query, page), fromCache = false)

  private fun matches(request: LibraryRequest): Boolean = mutableState.value.toRequest() == request

  private fun LibraryUiState.toRequest(): LibraryRequest = LibraryRequest(
    view = view,
    query = searchQuery,
    sort = sort,
    sortOrder = sortOrder,
    archiveSource = if (ArchiveSourceFilter.isAvailableFor(view, searchQuery)) archiveSource else ArchiveSourceFilter.All,
  )

  private fun loadArchiveSources() {
    val snapshot = mutableState.value
    if (!ArchiveSourceFilter.isAvailableFor(snapshot.view, snapshot.searchQuery)) return
    sourceLoadJob?.cancel()
    mutableState.update { it.copy(archiveSourcesLoading = true) }
    sourceLoadJob = viewModelScope.launch {
      try {
        val sources = repository.sources()
        if (!ArchiveSourceFilter.isAvailableFor(mutableState.value.view, mutableState.value.searchQuery)) return@launch
        mutableState.update { it.copy(archiveSources = sources, archiveSourcesLoading = false) }
      } catch (error: CancellationException) {
        throw error
      } catch (_: Throwable) {
        if (!ArchiveSourceFilter.isAvailableFor(mutableState.value.view, mutableState.value.searchQuery)) return@launch
        mutableState.update { it.copy(archiveSourcesLoading = false) }
      }
    }
  }

  fun open(id: Int) {
    viewModelScope.launch {
      val card = mutableState.value.articles.firstOrNull { it.id == id }
      mutableState.update { it.copy(loadingDetail = true, detail = null, detailError = null, detailRefreshing = false, savedReadingPosition = null) }
      runCatching { repository.detail(id, card?.publicId.takeIf { mutableState.value.view == LibraryView.Published }) }
        .onSuccess { article ->
          val position = runCatching { readingPositionRepository.get(id)?.scrollPercentage }.getOrNull()
          val offlineAvailable = runCatching { offlineDownloadManager.isAvailable(id) }.getOrDefault(false)
          mutableState.update { it.copy(loadingDetail = false, detail = article, savedReadingPosition = position, isOfflineAvailable = offlineAvailable) }
        }
        .onFailure { error -> mutableState.update { it.copy(loadingDetail = false, detailError = error.message ?: "加载文章失败") } }
    }
  }

  fun refreshDetail() {
    val snapshot = mutableState.value
    val detail = snapshot.detail ?: return
    if (snapshot.detailRefreshing) return
    viewModelScope.launch {
      mutableState.update { it.copy(detailRefreshing = true) }
      runCatching {
        repository.detail(detail.id, detail.publicId.takeIf { mutableState.value.view == LibraryView.Published })
      }.onSuccess { refreshed ->
        mutableState.update { current ->
          if (current.detail?.id != detail.id) current
          else current.copy(
            detail = refreshed,
            detailRefreshing = false,
            detailRefreshVersion = current.detailRefreshVersion + 1,
          )
        }
      }.onFailure { error ->
        mutableState.update { current ->
          if (current.detail?.id != detail.id) current
          else current.copy(detailRefreshing = false, processingError = error.message ?: "刷新文章失败")
        }
      }
    }
  }

  fun openByPublicId(publicId: String) {
    viewModelScope.launch {
      mutableState.update { it.copy(loadingDetail = true, detail = null, detailError = null, detailRefreshing = false, savedReadingPosition = null) }
      runCatching { repository.detail(0, publicId) }
        .onSuccess { article -> mutableState.update { it.copy(loadingDetail = false, detail = article) } }
        .onFailure { error -> mutableState.update { it.copy(loadingDetail = false, detailError = error.message ?: "加载文章失败") } }
    }
  }

  fun closeDetail() = mutableState.update { it.copy(detail = null, detailError = null, loadingDetail = false, detailRefreshing = false, savedReadingPosition = null) }

  fun toggleFavoriteCard(article: ArticleCard) {
    viewModelScope.launch {
      runCatching { repository.toggleFavorite(article.id) }.onSuccess { result ->
        mutableState.update { state ->
          state.copy(articles = state.articles.map { if (it.id == article.id) it.copy(isFavorited = result.isFavorited) else it })
        }
      }
    }
  }

  fun toggleArchiveCard(article: ArticleCard) {
    viewModelScope.launch {
      runCatching { repository.toggleArchive(article.id, article.isArchived) }.onSuccess { result ->
        mutableState.update { state ->
          val cards = if (state.view == LibraryView.Inbox && result.isArchived) state.articles.filterNot { it.id == article.id }
          else state.articles.map { if (it.id == article.id) it.copy(isArchived = result.isArchived) else it }
          state.copy(articles = cards)
        }
        loadCounts()
      }
    }
  }

  fun deleteCard(article: ArticleCard) {
    viewModelScope.launch {
      runCatching { repository.delete(article.id) }.onSuccess {
        mutableState.update { state -> state.copy(articles = state.articles.filterNot { it.id == article.id }) }
        loadCounts()
      }
    }
  }

  fun toggleFavorite(article: ArticleDetail) {
    viewModelScope.launch {
      runCatching { repository.toggleFavorite(article.id) }.onSuccess { result ->
        mutableState.update { state ->
          state.copy(
            detail = state.detail?.copy(isFavorited = result.isFavorited),
            articles = state.articles.map { if (it.id == article.id) it.copy(isFavorited = result.isFavorited) else it },
          )
        }
      }
    }
  }

  fun toggleArchive(article: ArticleDetail) {
    viewModelScope.launch {
      runCatching { repository.toggleArchive(article.id, article.isArchived) }.onSuccess { result ->
        mutableState.update { state ->
          val cards = if (state.view == LibraryView.Inbox && result.isArchived) state.articles.filterNot { it.id == article.id }
          else state.articles.map { if (it.id == article.id) it.copy(isArchived = result.isArchived) else it }
          state.copy(detail = state.detail?.copy(isArchived = result.isArchived), articles = cards)
        }
        if (mutableState.value.view == LibraryView.Archive) loadArchiveSources()
      }
    }
  }

  fun togglePublication(article: ArticleDetail) {
    viewModelScope.launch {
      runCatching { repository.togglePublication(article.id, article.isPublished) }.onSuccess { result ->
        mutableState.update { state ->
          val updated = result.article
          val cards = when {
            state.view == LibraryView.Inbox && updated.isArchived -> state.articles.filterNot { it.id == article.id }
            else -> state.articles.map {
              if (it.id == article.id) it.copy(
                isArchived = updated.isArchived,
                isPublished = updated.isPublished,
                publicId = updated.publicId ?: it.publicId,
              ) else it
            }
          }
          state.copy(
            detail = state.detail?.copy(
              isArchived = updated.isArchived,
              isPublished = updated.isPublished,
              publicId = updated.publicId ?: state.detail.publicId,
            ),
            articles = cards,
          )
        }
      }
    }
  }

  fun processArticle(article: ArticleDetail, action: ArticleProcessingAction) {
    if (mutableState.value.processingAction != null) return
    viewModelScope.launch {
      mutableState.update { it.copy(processingAction = action, processingError = null) }
      runCatching {
        when (action) {
          ArticleProcessingAction.Refetch -> repository.refetch(article.id)
          ArticleProcessingAction.RegenerateAi -> repository.regenerateAi(article.id)
        }
        repository.detail(article.id)
      }.onSuccess { refreshed ->
        mutableState.update { state ->
          state.copy(
            detail = refreshed,
            articles = state.articles.map { card ->
              if (card.id == article.id) card.copy(
                coverImage = refreshed.coverImage ?: card.coverImage,
                aiSummary = refreshed.aiSummary,
                aiCategory = refreshed.aiCategory,
                aiTags = refreshed.aiTags,
                isArchived = refreshed.isArchived,
                isPublished = refreshed.isPublished,
              ) else card
            },
            processingAction = null,
          )
        }
      }.onFailure { error ->
        mutableState.update { it.copy(processingAction = null, processingError = error.message ?: "文章处理失败") }
      }
    }
  }

  fun clearProcessingError() = mutableState.update { it.copy(processingError = null) }

  fun downloadOffline(article: ArticleDetail) {
    if (mutableState.value.downloadingOffline) return
    val html = article.contentHtml ?: return
    viewModelScope.launch {
      mutableState.update { it.copy(downloadingOffline = true, offlineError = null) }
      runCatching { offlineDownloadManager.download(article, html, article.coverImage) }
        .onSuccess { mutableState.update { it.copy(downloadingOffline = false, isOfflineAvailable = true) } }
        .onFailure { error -> mutableState.update { it.copy(downloadingOffline = false, offlineError = error.message ?: "下载失败") } }
    }
  }

  fun deleteOffline(articleId: Int) {
    viewModelScope.launch {
      runCatching { offlineDownloadManager.delete(articleId) }
        .onSuccess { mutableState.update { it.copy(isOfflineAvailable = false) } }
    }
  }

  fun clearOfflineError() = mutableState.update { it.copy(offlineError = null) }

  fun saveReadingPosition(articleId: Int, percentage: Float) {
    viewModelScope.launch {
      runCatching { readingPositionRepository.save(articleId, percentage) }
    }
  }

  fun delete(article: ArticleDetail) {
    viewModelScope.launch {
      runCatching { repository.delete(article.id) }.onSuccess {
        mutableState.update { state -> state.copy(detail = null, articles = state.articles.filterNot { it.id == article.id }) }
        loadCounts()
      }
    }
  }

  fun deletePermanent(article: ArticleDetail) {
    if (mutableState.value.permanentDeleting) return
    viewModelScope.launch {
      mutableState.update { it.copy(permanentDeleting = true) }
      runCatching { repository.deletePermanent(article.id) }.onSuccess {
        mutableState.update { state -> state.copy(detail = null, permanentDeleting = false, articles = state.articles.filterNot { it.id == article.id }) }
        loadCounts()
      }.onFailure { error ->
        mutableState.update { it.copy(permanentDeleting = false, processingError = error.message ?: "永久删除失败") }
      }
    }
  }

  private fun loadCounts() {
    viewModelScope.launch {
      runCatching { repository.counts() }.onSuccess { counts ->
        val badges = computeBadgeCounts(counts)
        mutableState.update { it.copy(counts = counts, badgeCounts = badges) }
      }
    }
  }

  /** 计算各视图的新增 badge 数量 = max(0, 当前数 - 上次查看数) */
  private fun computeBadgeCounts(counts: ArticleCounts): Map<LibraryView, Int> {
    val current = mapOf(
      LibraryView.Inbox to counts.inbox,
      LibraryView.Favorites to counts.favorites,
      LibraryView.Archive to counts.archive,
      LibraryView.Published to counts.published,
    )
    if (lastSeenCounts.isEmpty()) lastSeenCounts.putAll(current)
    return current.mapValues { (view, count) -> maxOf(0, count - (lastSeenCounts[view] ?: count)) }
  }
}
