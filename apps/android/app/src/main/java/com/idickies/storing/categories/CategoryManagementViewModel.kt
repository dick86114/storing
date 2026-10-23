package com.idickies.storing.categories

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.idickies.storing.library.CategoryMutationRequest
import com.idickies.storing.library.CategoryOptimizeDraft
import com.idickies.storing.library.CategoryOptimizeRequest
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class CategoryManagementUiState(
  val categories: List<com.idickies.storing.library.ArticleCategory> = emptyList(),
  val counts: Map<String, Int> = emptyMap(),
  val loading: Boolean = true,
  val saving: Boolean = false,
  val error: String? = null,
  val notice: String? = null,
)

@HiltViewModel
class CategoryManagementViewModel @Inject constructor(
  private val catalog: CategoryCatalogRepository,
) : ViewModel() {
  private val mutableState = MutableStateFlow(CategoryManagementUiState())
  val state = mutableState.asStateFlow()

  init {
    viewModelScope.launch {
      catalog.state.collect { catalogState ->
        mutableState.update {
          it.copy(
            categories = catalogState.categories,
            counts = catalogState.counts,
            loading = catalogState.loading && catalogState.categories.isEmpty(),
            error = catalogState.error,
          )
        }
      }
    }
    refresh()
  }

  fun refresh() = viewModelScope.launch {
    catalog.refresh()
  }

  fun create(request: CategoryMutationRequest, onComplete: (Boolean) -> Unit) = mutate(onComplete) {
    when (val result = catalog.createCategory(request)) {
      is CategoryCreationResult.Created -> Unit
      is CategoryCreationResult.Existing -> throw IllegalArgumentException("已存在同名分类")
      is CategoryCreationResult.Failed -> throw IllegalArgumentException(result.message)
    }
  }

  fun update(id: Int, request: CategoryMutationRequest, onComplete: (Boolean) -> Unit) = mutate(onComplete) {
    catalog.updateCategory(id, request)
  }

  fun delete(id: Int, targetCategoryId: Int, onComplete: (Boolean) -> Unit) = mutate(onComplete) {
    catalog.deleteCategory(id, targetCategoryId)
  }

  fun reorder(categoryIds: List<Int>) = mutate({}) {
    catalog.reorderCategories(categoryIds)
  }

  fun merge(sourceId: Int, targetId: Int, onComplete: (Boolean) -> Unit) = mutate(onComplete) {
    catalog.mergeCategories(sourceId, targetId)
  }

  fun optimize(request: CategoryOptimizeRequest, onComplete: (CategoryOptimizeDraft?) -> Unit) = viewModelScope.launch {
    if (mutableState.value.saving) return@launch
    mutableState.update { it.copy(saving = true, error = null) }
    runCatching { catalog.optimizeCategoryDescription(request).draft }
      .onSuccess { onComplete(it) }
      .onFailure { error ->
        mutableState.update { it.copy(error = error.message ?: "AI 优化分类说明失败") }
        onComplete(null)
      }
    mutableState.update { it.copy(saving = false) }
  }

  fun dismissNotice() = mutableState.update { it.copy(notice = null) }

  private fun mutate(onComplete: (Boolean) -> Unit, operation: suspend () -> Unit) = viewModelScope.launch {
    if (mutableState.value.saving) return@launch
    mutableState.update { it.copy(saving = true, error = null, notice = null) }
    runCatching { operation() }
      .onSuccess {
        mutableState.update { it.copy(notice = "分类已更新") }
        onComplete(true)
      }
      .onFailure { error ->
        mutableState.update { it.copy(error = error.message ?: "分类操作失败") }
        onComplete(false)
      }
    mutableState.update { it.copy(saving = false) }
  }
}
