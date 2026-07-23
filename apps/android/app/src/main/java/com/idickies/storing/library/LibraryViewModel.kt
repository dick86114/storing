package com.idickies.storing.library

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class LibraryUiState(
  val view: LibraryView = LibraryView.Inbox,
  val articles: List<ArticleCard> = emptyList(),
  val loading: Boolean = true,
  val refreshing: Boolean = false,
  val error: String? = null,
  val searchQuery: String = "",
  val detail: ArticleDetail? = null,
  val loadingDetail: Boolean = false,
  val detailError: String? = null,
)

@HiltViewModel
class LibraryViewModel @Inject constructor(
  private val repository: ArticleRepository,
) : ViewModel() {
  private val mutableState = MutableStateFlow(LibraryUiState())
  val state = mutableState.asStateFlow()

  init { load() }

  fun select(view: LibraryView) {
    if (view == mutableState.value.view && mutableState.value.searchQuery.isEmpty()) return
    mutableState.update { it.copy(view = view, searchQuery = "", articles = emptyList()) }
    load()
  }

  fun refresh() = load(refreshing = true)

  fun search(query: String) {
    mutableState.update { it.copy(searchQuery = query) }
    if (query.isBlank()) load() else load(query = query)
  }

  private fun load(refreshing: Boolean = false, query: String = mutableState.value.searchQuery) {
    viewModelScope.launch {
      mutableState.update { it.copy(loading = !refreshing, refreshing = refreshing, error = null) }
      runCatching {
        if (query.isBlank()) repository.list(mutableState.value.view) else repository.search(query)
      }.onSuccess { response ->
        mutableState.update { it.copy(articles = response.articles, loading = false, refreshing = false) }
      }.onFailure { error ->
        mutableState.update { it.copy(loading = false, refreshing = false, error = error.message ?: "加载文章失败") }
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
