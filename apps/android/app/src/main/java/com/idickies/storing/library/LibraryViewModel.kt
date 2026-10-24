package com.idickies.storing.library

import android.net.Uri
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.launch
import com.idickies.storing.categories.CategoryCatalogRepository
import com.idickies.storing.categories.CategoryCreationResult
import com.idickies.storing.library.ArticleCard
import com.idickies.storing.network.ArticleCounts
import com.idickies.storing.reader.ReadingPositionRepository
import com.idickies.storing.offline.OfflineDownloadManager
import com.idickies.storing.offline.offlineReaderDetail
import javax.inject.Inject

private const val SEARCH_DEBOUNCE_MILLIS = 350L

/**
 * Refreshes the first page without collapsing already-loaded pages, so the list can
 * keep its visible range stable while new items arrive at the top.
 */
internal fun <T> mergeRefreshedFirstPage(
  incoming: List<T>,
  current: List<T>,
  idOf: (T) -> Int,
): List<T> {
  if (current.isEmpty()) return incoming
  val incomingIds = incoming.asSequence().map(idOf).toSet()
  return (incoming + current.filterNot { idOf(it) in incomingIds })
    .take(current.size.coerceAtLeast(incoming.size))
}

/** 分类被删除或停用后，当前归档筛选必须立即失效并回到全部归档。 */
internal fun reconcileArchiveCategorySelection(
  state: LibraryUiState,
  activeCategories: List<ArticleCategory>,
): LibraryUiState {
  val categoryId = state.archiveCategoryId ?: return state
  if (state.view != LibraryView.Archive) return state
  if (activeCategories.any { it.id == categoryId && it.isActive }) return state
  return state.copy(
    archiveCategoryId = null,
    articles = emptyList(),
    page = 1,
    totalPages = 0,
    fromCache = false,
    searchPending = false,
    loadMoreError = null,
  )
}

private data class LibraryRequest(
  val view: LibraryView,
  val query: String,
  val sort: LibrarySort,
  val sortOrder: String,
  val archiveSource: ArchiveSourceFilter,
  val archiveCategoryId: Int?,
  val archiveTagFilter: ArchiveTagFilter,
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
  val archiveCategories: List<ArticleCategory> = emptyList(),
  val recentArchiveCategories: List<ArticleCategory> = emptyList(),
  val archiveCategoryCounts: Map<String, Int> = emptyMap(),
  val archiveCategoryId: Int? = null,
  val archiveCategoriesLoading: Boolean = false,
  val archiveCategoriesError: String? = null,
  val archiveTagFilter: ArchiveTagFilter = ArchiveTagFilter.All,
  val archiveTags: List<ArticleTag> = emptyList(),
  val archiveTagsLoading: Boolean = false,
  val batchCategoryUpdating: Boolean = false,
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
  val isReadingOffline: Boolean = false,
  val downloadingOffline: Boolean = false,
  val offlineError: String? = null,
  val bulkRunningAction: BulkToolbarAction? = null,
  val bulkResult: NativeBulkResult? = null,
  val bulkExportJob: ArticleBulkExportJob? = null,
  val bulkExportDownloading: Boolean = false,
) {
  val hasMore: Boolean get() = LibraryPaging(page = page, totalPages = totalPages).hasMore
}

@HiltViewModel
class LibraryViewModel @Inject constructor(
  private val repository: ArticleRepository,
  private val readingPositionRepository: ReadingPositionRepository,
  private val offlineDownloadManager: OfflineDownloadManager,
  private val bulkExportDownloader: BulkExportDownloader,
  private val categoryCatalogRepository: CategoryCatalogRepository,
) : ViewModel() {
  private val mutableState = MutableStateFlow(LibraryUiState())
  val state = mutableState.asStateFlow()

  private var listLoadJob: Job? = null
  private var searchDebounceJob: Job? = null
  private var loadMoreJob: Job? = null
  private var sourceLoadJob: Job? = null
  private var tagLoadJob: Job? = null
  private val categoryAssignmentMutex = Mutex()
  private var bulkExportPollJob: Job? = null
  private val lastSeenCounts = mutableMapOf<LibraryView, Int>()

  init {
    viewModelScope.launch {
      categoryCatalogRepository.state.collect { catalog ->
        val current = mutableState.value
        val reconciled = reconcileArchiveCategorySelection(current, catalog.activeCategories)
        val next = reconciled.copy(
          archiveCategories = catalog.activeCategories,
          recentArchiveCategories = catalog.recentCategories,
          archiveCategoryCounts = catalog.counts,
          archiveCategoriesLoading = catalog.loading && catalog.activeCategories.isEmpty(),
          archiveCategoriesError = catalog.error,
        )
        mutableState.value = next
        if (reconciled.archiveCategoryId != current.archiveCategoryId && next.view == LibraryView.Archive) {
          loadInitial()
        }
      }
    }
    viewModelScope.launch { categoryCatalogRepository.refresh() }
    loadInitial()
    loadCounts()
  }

  fun select(view: LibraryView) {
    if (view == mutableState.value.view && mutableState.value.searchQuery.isEmpty()) return
    searchDebounceJob?.cancel()
    sourceLoadJob?.cancel()
    tagLoadJob?.cancel()
    mutableState.update {
      it.copy(
        view = view,
        searchQuery = "",
        sort = LibrarySort.defaultFor(view),
        sortOrder = "desc",
        archiveSource = ArchiveSourceFilter.All,
        archiveCategoryId = null,
        archiveTagFilter = ArchiveTagFilter.All,
        archiveSourcesLoading = false,
        archiveCategoriesLoading = false,
        archiveTagsLoading = false,
        articles = emptyList(),
        loading = true,
        refreshing = false,
        page = 1,
        totalPages = 0,
        fromCache = false,
        searchPending = false,
        loadMoreError = null,
      )
    }
    markViewSeen(view)
    loadInitial()
    if (view == LibraryView.Archive) {
      loadArchiveSources()
      loadArchiveCategories()
      loadArchiveTags()
    }
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
    loadInitial(refreshing = true, preserveLoadedContent = true)
    if (ArchiveSourceFilter.isAvailableFor(mutableState.value.view, mutableState.value.searchQuery)) {
      loadArchiveSources()
      loadArchiveCategories()
      loadArchiveTags()
    }
    loadCounts()
  }

  fun selectArchiveSource(filter: ArchiveSourceFilter) = selectArchiveSources(filter.categories)

  fun selectArchiveSources(categories: Set<String>) {
    val snapshot = mutableState.value
    val filter = ArchiveSourceFilter.of(*categories.toTypedArray())
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

  fun selectArchiveCategory(categoryId: Int?) {
    val snapshot = mutableState.value
    if (!ArchiveSourceFilter.isAvailableFor(snapshot.view, snapshot.searchQuery) || categoryId == snapshot.archiveCategoryId) return
    mutableState.update {
      it.copy(
        archiveCategoryId = categoryId,
        articles = emptyList(),
        page = 1,
        totalPages = 0,
        fromCache = false,
        loadMoreError = null,
      )
    }
    loadInitial()
  }

  fun selectArchiveTags(tags: List<String>) {
    val snapshot = mutableState.value
    val filter = ArchiveTagFilter.of(*tags.toTypedArray())
    if (!ArchiveSourceFilter.isAvailableFor(snapshot.view, snapshot.searchQuery) || filter == snapshot.archiveTagFilter) return
    mutableState.update {
      it.copy(
        archiveTagFilter = filter,
        articles = emptyList(),
        page = 1,
        totalPages = 0,
        fromCache = false,
        loadMoreError = null,
      )
    }
    loadInitial()
  }

  fun prepareArchiveCategories() {
    revalidateArchiveCategorySelection()
    loadArchiveCategories(force = true)
  }

  suspend fun createCategoryForAssignment(request: CategoryMutationRequest): CategoryCreationResult =
    categoryCatalogRepository.createCategory(request)

  fun createArchiveCategory(
    rawName: String,
    onComplete: (category: ArticleCategory?, errorMessage: String?) -> Unit,
  ) {
    viewModelScope.launch {
      when (val result = categoryCatalogRepository.createCategory(rawName)) {
        is CategoryCreationResult.Created -> onComplete(result.category, null)
        is CategoryCreationResult.Existing -> onComplete(result.category, "已存在同名分类，已为你选中")
        is CategoryCreationResult.Failed -> onComplete(null, result.message)
      }
    }
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
      if (mutableState.value.view == LibraryView.Archive) loadArchiveTags()
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

  private fun loadInitial(refreshing: Boolean = false, preserveLoadedContent: Boolean = false) {
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
          val keepLoadedRange = preserveLoadedContent && it.articles.isNotEmpty()
          it.copy(
            articles = if (keepLoadedRange) {
              mergeRefreshedFirstPage(result.response.articles, it.articles) { article -> article.id }
            } else {
              result.response.articles
            },
            page = if (keepLoadedRange) {
              it.page.coerceAtMost(result.response.totalPages.coerceAtLeast(result.response.page))
            } else {
              result.response.page
            },
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
    if (request.query.isBlank()) repository.list(request.view, page, request.sort, archiveSourceQueryCategories(request.archiveSource), request.archiveCategoryId, archiveTagQueryValues(request.archiveTagFilter), request.sortOrder)
    else ArticleListLoad(repository.search(request.query, page), fromCache = false)

  private fun matches(request: LibraryRequest): Boolean = mutableState.value.toRequest() == request

  private fun LibraryUiState.toRequest(): LibraryRequest = LibraryRequest(
    view = view,
    query = searchQuery,
    sort = sort,
    sortOrder = sortOrder,
    archiveSource = if (ArchiveSourceFilter.isAvailableFor(view, searchQuery)) archiveSource else ArchiveSourceFilter.All,
    archiveCategoryId = if (ArchiveSourceFilter.isAvailableFor(view, searchQuery)) archiveCategoryId else null,
    archiveTagFilter = if (ArchiveSourceFilter.isAvailableFor(view, searchQuery)) archiveTagFilter else ArchiveTagFilter.All,
  )

  private fun revalidateArchiveCategorySelection() {
    val current = mutableState.value
    val next = reconcileArchiveCategorySelection(current, categoryCatalogRepository.state.value.activeCategories)
    if (next != current) {
      mutableState.value = next
      if (next.view == LibraryView.Archive) loadInitial()
    }
  }

  private fun loadArchiveCategories(force: Boolean = false) {
    revalidateArchiveCategorySelection()
    val snapshot = mutableState.value
    if (!force && !ArchiveSourceFilter.isAvailableFor(snapshot.view, snapshot.searchQuery)) return
    viewModelScope.launch {
      if (force) categoryCatalogRepository.refresh() else categoryCatalogRepository.ensureLoaded()
    }
  }

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

  private fun loadArchiveTags() {
    val snapshot = mutableState.value
    if (!ArchiveSourceFilter.isAvailableFor(snapshot.view, snapshot.searchQuery)) return
    tagLoadJob?.cancel()
    mutableState.update { it.copy(archiveTagsLoading = true) }
    tagLoadJob = viewModelScope.launch {
      try {
        val tags = repository.tags()
        if (!ArchiveSourceFilter.isAvailableFor(mutableState.value.view, mutableState.value.searchQuery)) return@launch
        mutableState.update { it.copy(archiveTags = tags, archiveTagsLoading = false) }
      } catch (error: CancellationException) {
        throw error
      } catch (_: Throwable) {
        if (!ArchiveSourceFilter.isAvailableFor(mutableState.value.view, mutableState.value.searchQuery)) return@launch
        mutableState.update { it.copy(archiveTagsLoading = false) }
      }
    }
  }

  /** Opens a saved local copy first, falling back to the network only when no usable copy exists. */
  fun open(id: Int) {
    viewModelScope.launch {
      val card = mutableState.value.articles.firstOrNull { it.id == id }
      mutableState.update {
        it.copy(
          loadingDetail = true,
          detail = null,
          detailError = null,
          detailRefreshing = false,
          savedReadingPosition = null,
          isReadingOffline = false,
        )
      }
      val position = runCatching { readingPositionRepository.get(id)?.scrollPercentage }.getOrNull()
      val offline = runCatching { offlineDownloadManager.loadOfflineContent(id) }.getOrNull()
      if (offline != null) {
        mutableState.update {
          it.copy(
            loadingDetail = false,
            detail = offlineReaderDetail(card, offline),
            savedReadingPosition = position,
            isOfflineAvailable = true,
            isReadingOffline = true,
          )
        }
        return@launch
      }
      runCatching { repository.detail(id, card?.publicId.takeIf { mutableState.value.view == LibraryView.Published }) }
        .onSuccess { article ->
          val offlineAvailable = runCatching { offlineDownloadManager.isAvailable(id) }.getOrDefault(false)
          mutableState.update {
            it.copy(
              loadingDetail = false,
              detail = article,
              savedReadingPosition = position,
              isOfflineAvailable = offlineAvailable,
              isReadingOffline = false,
            )
          }
          if (article.isArchived) loadArchiveCategories(force = true)
        }
        .onFailure { error -> mutableState.update { it.copy(loadingDetail = false, detailError = error.message ?: "加载文章失败") } }
    }
  }

  /** Opens a local article directly from offline-content management without any network request. */
  fun openOffline(id: Int) {
    viewModelScope.launch {
      mutableState.update {
        it.copy(
          loadingDetail = true,
          detail = null,
          detailError = null,
          detailRefreshing = false,
          savedReadingPosition = null,
          isReadingOffline = false,
        )
      }
      val offline = runCatching { offlineDownloadManager.loadOfflineContent(id) }.getOrNull()
      if (offline == null) {
        mutableState.update { it.copy(loadingDetail = false, detailError = "离线内容已被清除或损坏") }
        return@launch
      }
      val position = runCatching { readingPositionRepository.get(id)?.scrollPercentage }.getOrNull()
      mutableState.update {
        it.copy(
          loadingDetail = false,
          detail = offlineReaderDetail(card = null, offline = offline),
          savedReadingPosition = position,
          isOfflineAvailable = true,
          isReadingOffline = true,
        )
      }
    }
  }

  /** Serves only validated app-owned offline image URLs to the reader WebView. */
  fun openOfflineAsset(uri: Uri) = offlineDownloadManager.openOfflineAsset(uri)

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
            isReadingOffline = false,
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
      mutableState.update { it.copy(loadingDetail = true, detail = null, detailError = null, detailRefreshing = false, savedReadingPosition = null, isReadingOffline = false) }
      runCatching { repository.detail(0, publicId) }
        .onSuccess { article -> mutableState.update { it.copy(loadingDetail = false, detail = article, isReadingOffline = false) } }
        .onFailure { error -> mutableState.update { it.copy(loadingDetail = false, detailError = error.message ?: "加载文章失败") } }
    }
  }

  fun closeDetail() = mutableState.update { it.copy(detail = null, detailError = null, loadingDetail = false, detailRefreshing = false, savedReadingPosition = null, isReadingOffline = false) }

  fun toggleFavoriteCard(article: ArticleCard) {
    viewModelScope.launch {
      runCatching { repository.toggleFavorite(article.id) }.onSuccess { result ->
        mutableState.update { state ->
          state.copy(articles = state.articles.map { if (it.id == article.id) it.copy(isFavorited = result.isFavorited) else it })
        }
      }
    }
  }

  fun toggleArchiveCard(article: ArticleCard, categoryId: Int? = null) {
    viewModelScope.launch {
      runCatching { repository.toggleArchive(article.id, article.isArchived, categoryId) }.onSuccess { result ->
        mutableState.update { state ->
          val cards = if (state.view == LibraryView.Inbox && result.isArchived) state.articles.filterNot { it.id == article.id }
          else state.articles.map { if (it.id == article.id) it.copy(isArchived = result.isArchived, category = result.category ?: it.category) else it }
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

  fun deletePermanentCard(article: ArticleCard) {
    viewModelScope.launch {
      runCatching { repository.deletePermanent(article.id) }.onSuccess {
        mutableState.update { state -> state.copy(articles = state.articles.filterNot { it.id == article.id }) }
        loadCounts()
      }
    }
  }

  fun unpublishCard(article: ArticleCard) {
    viewModelScope.launch {
      runCatching { repository.togglePublication(article.id, published = true) }.onSuccess { result ->
        mutableState.update { state ->
          state.copy(articles = state.articles.map { if (it.id == article.id) it.copy(isPublished = result.article.isPublished) else it })
        }
        loadCounts()
      }
    }
  }

  fun updateTitle(article: ArticleDetail, title: String) {
    if (mutableState.value.processingAction != null) return
    viewModelScope.launch {
      mutableState.update { it.copy(processingAction = ArticleProcessingAction.Refetch, processingError = null) }
      runCatching { repository.updateTitle(article.id, title) }
        .onSuccess { result ->
          mutableState.update { state ->
            state.copy(
              processingAction = null,
              detail = state.detail?.copy(title = result.title),
              articles = state.articles.map { if (it.id == article.id) it.copy(title = result.title) else it },
            )
          }
        }
        .onFailure { error ->
          mutableState.update { it.copy(processingAction = null, processingError = error.message ?: "修改标题失败") }
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

  fun toggleArchive(article: ArticleDetail, categoryId: Int? = null) {
    viewModelScope.launch {
      runCatching { repository.toggleArchive(article.id, article.isArchived, categoryId) }.onSuccess { result ->
        mutableState.update { state ->
          val cards = if (state.view == LibraryView.Inbox && result.isArchived) state.articles.filterNot { it.id == article.id }
          else state.articles.map { if (it.id == article.id) it.copy(isArchived = result.isArchived, category = result.category ?: it.category) else it }
          state.copy(detail = state.detail?.copy(isArchived = result.isArchived, category = result.category ?: state.detail.category), articles = cards)
        }
        if (mutableState.value.view == LibraryView.Archive) loadArchiveSources()
      }
    }
  }

  fun moveToCategory(article: ArticleDetail, categoryId: Int) {
    if (!article.isArchived) return
    val category = mutableState.value.archiveCategories.firstOrNull { it.id == categoryId } ?: return
    viewModelScope.launch {
      runCatching { repository.moveToCategory(article.id, categoryId) }.onSuccess {
        mutableState.update { state ->
          val cards = state.articles.mapNotNull { card ->
            if (card.id != article.id) card
            else if (state.view == LibraryView.Archive && state.archiveCategoryId != null && state.archiveCategoryId != categoryId) null
            else card.copy(category = category)
          }
          state.copy(
            detail = state.detail?.let { current ->
              if (current.id == article.id) current.copy(category = category) else current
            },
            articles = cards,
          )
        }
        categoryCatalogRepository.recordRecentCategory(categoryId)
        loadArchiveCategories(force = true)
      }.onFailure { error ->
        mutableState.update { it.copy(processingError = error.message ?: "修改分类失败") }
      }
    }
  }

  suspend fun assignCategoryToArticle(
    articleId: Int,
    category: ArticleCategory,
    archiveIfNeeded: Boolean,
  ): CategoryAssignmentResult = withCategoryAssignmentLock {
    runCatching {
      if (archiveIfNeeded) {
        repository.toggleArchive(articleId, archived = false, categoryId = category.id)
      } else {
        repository.moveToCategory(articleId, category.id)
      }
    }.fold(
      onSuccess = { response ->
        val archived = when (response) {
          is ArchiveResponse -> response.isArchived
          else -> true
        }
        if (!archived && archiveIfNeeded) {
          CategoryAssignmentResult.CreatedButAssignmentFailed(category, "归档未完成")
        } else {
          applyAssignedCategory(setOf(articleId), category, archiveIfNeeded = archiveIfNeeded)
          categoryCatalogRepository.recordRecentCategory(category.id)
          categoryCatalogRepository.refresh()
          CategoryAssignmentResult.Success(category, succeededIds = setOf(articleId))
        }
      },
      onFailure = { CategoryAssignmentResult.Failure(it.message ?: "分类失败") },
    )
  }

  suspend fun assignCategoryToArticles(
    articleIds: Set<Int>,
    category: ArticleCategory,
    archiveIfNeeded: Boolean,
  ): CategoryAssignmentResult = withCategoryAssignmentLock {
    if (articleIds.isEmpty()) return@withCategoryAssignmentLock CategoryAssignmentResult.Failure("请先选择文章")
    runCatching {
      if (archiveIfNeeded) {
        repository.bulkAction(BulkArticleAction.Archive, articleIds.toList(), category.id)
      } else {
        repository.moveToCategory(articleIds.toList(), category.id)
      }
    }.fold(
      onSuccess = { response ->
        val result = categoryAssignmentBatchResult(category, articleIds, response)
        val succeededIds = when (result) {
          is CategoryAssignmentResult.Success -> result.succeededIds
          is CategoryAssignmentResult.Partial -> result.succeededIds
          is CategoryAssignmentResult.CompletedWithSkipped -> result.succeededIds
          else -> emptySet()
        }
        if (succeededIds.isNotEmpty()) {
          applyAssignedCategory(succeededIds, category, archiveIfNeeded = archiveIfNeeded)
          categoryCatalogRepository.recordRecentCategory(category.id)
          categoryCatalogRepository.refresh()
        }
        result
      },
      onFailure = { CategoryAssignmentResult.Failure(it.message ?: "批量分类失败") },
    )
  }

  private suspend fun withCategoryAssignmentLock(
    block: suspend () -> CategoryAssignmentResult,
  ): CategoryAssignmentResult {
    if (!categoryAssignmentMutex.tryLock()) {
      return CategoryAssignmentResult.Failure("分类请求正在处理中，请稍候")
    }
    return try {
      block()
    } finally {
      categoryAssignmentMutex.unlock()
    }
  }

  private fun applyAssignedCategory(
    articleIds: Set<Int>,
    category: ArticleCategory,
    archiveIfNeeded: Boolean,
  ) {
    mutableState.update { state ->
      val cards = state.articles.mapNotNull { card ->
        if (card.id !in articleIds) card
        else if (!archiveIfNeeded && state.view == LibraryView.Archive && state.archiveCategoryId != null && state.archiveCategoryId != category.id) null
        else card.copy(category = category, isArchived = if (archiveIfNeeded) true else card.isArchived)
      }.filterNot { card ->
        articleIds.contains(card.id) && archiveIfNeeded && state.view != LibraryView.Archive
      }
      state.copy(
        articles = cards,
        detail = state.detail?.let { detail ->
          if (detail.id in articleIds) detail.copy(
            category = category,
            isArchived = if (archiveIfNeeded) true else detail.isArchived,
          ) else detail
        },
        processingError = null,
      )
    }
    loadCounts()
  }

  fun reclassify(article: ArticleDetail) {
    if (mutableState.value.processingAction != null) return
    viewModelScope.launch {
      mutableState.update { it.copy(processingAction = ArticleProcessingAction.ReclassifyCategory, processingError = null) }
      runCatching {
        repository.classify(article.id)
        repository.detail(article.id)
      }.onSuccess { refreshed ->
        mutableState.update { state ->
          state.copy(
            detail = if (state.detail?.id == article.id) refreshed else state.detail,
            articles = state.articles.map { card ->
              if (card.id == article.id) card.copy(category = refreshed.category, categoryResult = refreshed.categoryResult) else card
            },
            processingAction = null,
          )
        }
        loadArchiveCategories(force = true)
      }.onFailure { error ->
        mutableState.update { it.copy(processingAction = null, processingError = error.message ?: "重新判断分类失败") }
      }
    }
  }

  fun moveToCategory(articleIds: Set<Int>, categoryId: Int, onComplete: (Boolean) -> Unit = {}) {
    if (articleIds.isEmpty() || mutableState.value.batchCategoryUpdating) return
    val category = mutableState.value.archiveCategories.firstOrNull { it.id == categoryId } ?: return
    viewModelScope.launch {
      mutableState.update { it.copy(batchCategoryUpdating = true, processingError = null) }
      runCatching { repository.moveToCategory(articleIds.toList(), categoryId) }.onSuccess {
        mutableState.update { state ->
          val cards = state.articles.mapNotNull { card ->
            if (card.id !in articleIds) card
            else if (state.view == LibraryView.Archive && state.archiveCategoryId != null && state.archiveCategoryId != categoryId) null
            else card.copy(category = category)
          }
          state.copy(articles = cards, batchCategoryUpdating = false)
        }
        loadArchiveCategories(force = true)
        onComplete(true)
      }.onFailure { error ->
        mutableState.update { it.copy(batchCategoryUpdating = false, processingError = error.message ?: "批量修改分类失败") }
        onComplete(false)
      }
    }
  }

  fun reclassify(articleIds: Set<Int>, onComplete: (Boolean) -> Unit = {}) {
    if (articleIds.isEmpty() || mutableState.value.batchCategoryUpdating) return
    viewModelScope.launch {
      mutableState.update { it.copy(batchCategoryUpdating = true, processingError = null) }
      runCatching { repository.classify(articleIds.toList()) }.onSuccess {
        mutableState.update { it.copy(batchCategoryUpdating = false) }
        loadInitial(refreshing = true, preserveLoadedContent = true)
        loadArchiveCategories(force = true)
        onComplete(true)
      }.onFailure { error ->
        mutableState.update { it.copy(batchCategoryUpdating = false, processingError = error.message ?: "批量重新判断分类失败") }
        onComplete(false)
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
          ArticleProcessingAction.ReclassifyCategory -> repository.classify(article.id)
          ArticleProcessingAction.UpdateTitle -> Unit
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

  fun runBulkToolbarAction(action: BulkToolbarAction, ids: Set<Int>) {
    if (action == BulkToolbarAction.SetCategory) return
    if (mutableState.value.bulkRunningAction != null) return
    val articleIds = validatedBulkArticleIds(ids)
    mutableState.update { it.copy(bulkRunningAction = action, bulkResult = null, processingError = null) }
    viewModelScope.launch {
      runCatching {
        when (action) {
          BulkToolbarAction.ReclassifyCategory -> repository.bulkRegenerateAi(articleIds, includeCategory = true)
          BulkToolbarAction.GenerateAi -> repository.bulkRegenerateAi(articleIds, includeCategory = false)
          BulkToolbarAction.ExportZip -> repository.createBulkExport(articleIds)
          else -> repository.bulkAction(action.toBulkArticleAction(), articleIds)
        }
      }.onSuccess { value ->
        when (value) {
          is ArticleBulkExportJob -> {
            mutableState.update { it.copy(bulkExportJob = value) }
            pollBulkExport(value.id)
          }
          is ArticleBulkAiResult -> {
            val result = NativeBulkResult.from(value)
            mutableState.update { it.copy(bulkResult = result, bulkRunningAction = null) }
            loadInitial(refreshing = true, preserveLoadedContent = true)
            loadCounts()
          }
          is ArticleBulkActionResult -> {
            val result = NativeBulkResult.from(value)
            mutableState.update { state ->
              state.copy(
                bulkResult = result,
                bulkRunningAction = null,
                articles = if (action == BulkToolbarAction.Delete || action == BulkToolbarAction.PermanentDelete) {
                  state.articles.filterNot { it.id in value.succeededIds }
                } else {
                  state.articles
                },
              )
            }
            loadInitial(refreshing = true, preserveLoadedContent = true)
            loadCounts()
          }
        }
      }.onFailure { error ->
        mutableState.update { it.copy(bulkRunningAction = null, processingError = error.message ?: "批量操作失败") }
      }
    }
  }

  fun runBulkArchive(ids: Set<Int>, categoryId: Int? = null) {
    if (mutableState.value.bulkRunningAction != null) return
    val articleIds = validatedBulkArticleIds(ids)
    mutableState.update { it.copy(bulkRunningAction = BulkToolbarAction.Archive, bulkResult = null, processingError = null) }
    viewModelScope.launch {
      runCatching { repository.bulkAction(BulkArticleAction.Archive, articleIds, categoryId) }
        .onSuccess { result ->
          mutableState.update { state ->
            state.copy(
              bulkResult = NativeBulkResult.from(result),
              bulkRunningAction = null,
              articles = state.articles.filterNot { it.id in result.succeededIds && state.view != LibraryView.Archive },
            )
          }
          loadInitial(refreshing = true, preserveLoadedContent = true)
          loadCounts()
        }
        .onFailure { error ->
          mutableState.update { it.copy(bulkRunningAction = null, processingError = error.message ?: "批量归档失败") }
        }
    }
  }

  fun runBulkCategoryAi(ids: Set<Int>) {
    if (mutableState.value.bulkRunningAction != null) return
    val articleIds = validatedBulkArticleIds(ids)
    mutableState.update { it.copy(bulkRunningAction = BulkToolbarAction.SetCategory, bulkResult = null, processingError = null) }
    viewModelScope.launch {
      runCatching { repository.bulkRegenerateAi(articleIds, includeCategory = true, resetUserCategory = true) }
        .onSuccess { result ->
          mutableState.update { it.copy(bulkResult = NativeBulkResult.from(result), bulkRunningAction = null) }
          loadInitial(refreshing = true, preserveLoadedContent = true)
          loadCounts()
          loadArchiveCategories(force = true)
        }
        .onFailure { error ->
          mutableState.update { it.copy(bulkRunningAction = null, processingError = error.message ?: "批量 AI 分类失败") }
        }
    }
  }

  fun runBulkCategory(ids: Set<Int>, categoryId: Int) {
    if (mutableState.value.bulkRunningAction != null) return
    val articleIds = validatedBulkArticleIds(ids)
    mutableState.update { it.copy(bulkRunningAction = BulkToolbarAction.SetCategory) }
    viewModelScope.launch {
      runCatching { repository.moveToCategory(articleIds, categoryId) }
        .onSuccess { result ->
          val normalized = NativeBulkResult.from(result)
          mutableState.update { state ->
            state.copy(
              bulkResult = normalized,
              bulkRunningAction = null,
              articles = state.articles.map { card ->
                if (card.id !in result.succeededIds) card
                else card.copy(category = state.archiveCategories.firstOrNull { it.id == categoryId })
              },
            )
          }
          loadInitial(refreshing = true, preserveLoadedContent = true)
          loadCounts()
          loadArchiveCategories(force = true)
        }
        .onFailure { error ->
          mutableState.update { it.copy(bulkRunningAction = null, processingError = error.message ?: "批量修改分类失败") }
        }
    }
  }

  fun clearBulkResult() = mutableState.update { it.copy(bulkResult = null) }

  fun downloadBulkExport() {
    val job = mutableState.value.bulkExportJob ?: return
    if (mutableState.value.bulkExportDownloading || job.status != ArticleBulkExportStatus.Succeeded) return
    viewModelScope.launch {
      mutableState.update { it.copy(bulkExportDownloading = true) }
      runCatching { bulkExportDownloader.download(job) }
        .onSuccess { mutableState.update { it.copy(bulkExportDownloading = false) } }
        .onFailure { error -> mutableState.update { it.copy(bulkExportDownloading = false, processingError = error.message ?: "导出文件下载失败") } }
    }
  }

  private fun pollBulkExport(jobId: Int) {
    bulkExportPollJob?.cancel()
    bulkExportPollJob = viewModelScope.launch {
      val startedAtNanos = System.nanoTime()
      while (true) {
        // 导出前期保持 1.5 秒响应，超过 1 分钟后降到 5 秒，减少长时间轮询的耗电。
        val elapsedSeconds = (System.nanoTime() - startedAtNanos) / 1_000_000_000
        delay(if (elapsedSeconds < 60) 1_500 else 5_000)
        runCatching { repository.bulkExport(jobId) }
          .onSuccess { job ->
            mutableState.update { it.copy(bulkExportJob = job) }
            if (job.status == ArticleBulkExportStatus.Succeeded || job.status == ArticleBulkExportStatus.Failed) return@launch
          }
          .onFailure { error ->
            mutableState.update { it.copy(processingError = error.message ?: "查询导出任务失败") }
            return@launch
          }
      }
    }
  }

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
        .onSuccess { mutableState.update { it.copy(isOfflineAvailable = false, isReadingOffline = false) } }
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
