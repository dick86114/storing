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
import javax.inject.Inject

private const val SEARCH_DEBOUNCE_MILLIS = 350L

private data class LibraryRequest(
  val view: LibraryView,
  val query: String,
  val sort: LibrarySort,
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
  val archiveSource: ArchiveSourceFilter = ArchiveSourceFilter.All,
  val archiveSources: List<ArticleSource> = emptyList(),
  val archiveSourcesLoading: Boolean = false,
  val page: Int = 1,
  val totalPages: Int = 0,
  val detail: ArticleDetail? = null,
  val loadingDetail: Boolean = false,
  val detailError: String? = null,
) {
  val hasMore: Boolean get() = LibraryPaging(page = page, totalPages = totalPages).hasMore
}

@HiltViewModel
class LibraryViewModel @Inject constructor(
  private val repository: ArticleRepository,
) : ViewModel() {
  private val mutableState = MutableStateFlow(LibraryUiState())
  val state = mutableState.asStateFlow()

  private var listLoadJob: Job? = null
  private var searchDebounceJob: Job? = null
  private var loadMoreJob: Job? = null
  private var sourceLoadJob: Job? = null

  init { loadInitial() }

  fun select(view: LibraryView) {
    if (view == mutableState.value.view && mutableState.value.searchQuery.isEmpty()) return
    searchDebounceJob?.cancel()
    sourceLoadJob?.cancel()
    mutableState.update {
      it.copy(
        view = view,
        searchQuery = "",
        sort = LibrarySort.defaultFor(view),
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
    loadInitial()
    if (view == LibraryView.Archive) loadArchiveSources()
  }

  fun refresh() {
    searchDebounceJob?.cancel()
    loadInitial(refreshing = true)
    if (ArchiveSourceFilter.isAvailableFor(mutableState.value.view, mutableState.value.searchQuery)) loadArchiveSources()
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

  fun selectSort(sort: LibrarySort) {
    val snapshot = mutableState.value
    if (snapshot.searchQuery.isNotBlank() || sort !in LibrarySort.availableFor(snapshot.view) || sort == snapshot.sort) return
    mutableState.update {
      it.copy(
        sort = sort,
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
    if (request.query.isBlank()) repository.list(request.view, page, request.sort, request.archiveSource.category)
    else ArticleListLoad(repository.search(request.query, page), fromCache = false)

  private fun matches(request: LibraryRequest): Boolean = mutableState.value.toRequest() == request

  private fun LibraryUiState.toRequest(): LibraryRequest = LibraryRequest(
    view = view,
    query = searchQuery,
    sort = sort,
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
      mutableState.update { it.copy(loadingDetail = true, detail = null, detailError = null) }
      runCatching { repository.detail(id) }
        .onSuccess { article -> mutableState.update { it.copy(loadingDetail = false, detail = article) } }
        .onFailure { error -> mutableState.update { it.copy(loadingDetail = false, detailError = error.message ?: "加载文章失败") } }
    }
  }

  fun closeDetail() = mutableState.update { it.copy(detail = null, detailError = null, loadingDetail = false) }

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

  fun delete(article: ArticleDetail) {
    viewModelScope.launch {
      runCatching { repository.delete(article.id) }.onSuccess {
        mutableState.update { state -> state.copy(detail = null, articles = state.articles.filterNot { it.id == article.id }) }
      }
    }
  }
}
