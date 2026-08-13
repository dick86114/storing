package com.idickies.storing.categories

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.idickies.storing.library.ArticleCategory
import com.idickies.storing.library.ArticleRepository
import com.idickies.storing.library.CategoryMutationRequest
import com.idickies.storing.library.CategoryOptimizeDraft
import com.idickies.storing.library.CategoryOptimizeRequest
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class CategoryManagementUiState(
  val categories: List<ArticleCategory> = emptyList(),
  val counts: Map<String, Int> = emptyMap(),
  val loading: Boolean = true,
  val saving: Boolean = false,
  val error: String? = null,
)

@HiltViewModel
class CategoryManagementViewModel @Inject constructor(
  private val repository: ArticleRepository,
) : ViewModel() {
  private val mutableState = MutableStateFlow(CategoryManagementUiState())
  val state = mutableState.asStateFlow()

  init { refresh() }

  fun refresh() = viewModelScope.launch {
    mutableState.update { it.copy(loading = true, error = null) }
    runCatching { repository.categories(includeInactive = true) }
      .onSuccess { response -> mutableState.update { it.copy(categories = response.categories, counts = response.counts, loading = false) } }
      .onFailure { error -> mutableState.update { it.copy(loading = false, error = error.message ?: "加载分类失败") } }
  }

  fun create(request: CategoryMutationRequest, onComplete: (Boolean) -> Unit) = mutate(onComplete) {
    repository.createCategory(request)
  }

  fun update(id: Int, request: CategoryMutationRequest, onComplete: (Boolean) -> Unit) = mutate(onComplete) {
    repository.updateCategory(id, request)
  }

  fun delete(id: Int, targetCategoryId: Int, onComplete: (Boolean) -> Unit) = mutate(onComplete) {
    repository.deleteCategory(id, targetCategoryId)
  }

  fun reorder(categoryIds: List<Int>) = mutate({}) { repository.reorderCategories(categoryIds) }

  fun optimize(request: CategoryOptimizeRequest, onComplete: (CategoryOptimizeDraft?) -> Unit) = viewModelScope.launch {
    if (mutableState.value.saving) return@launch
    mutableState.update { it.copy(saving = true, error = null) }
    runCatching { repository.optimizeCategoryDescription(request).draft }
      .onSuccess { onComplete(it) }
      .onFailure { error ->
        mutableState.update { it.copy(error = error.message ?: "AI 优化分类说明失败") }
        onComplete(null)
      }
    mutableState.update { it.copy(saving = false) }
  }

  private fun mutate(onComplete: (Boolean) -> Unit, operation: suspend () -> Any) = viewModelScope.launch {
    if (mutableState.value.saving) return@launch
    mutableState.update { it.copy(saving = true, error = null) }
    runCatching { operation() }
      .onSuccess {
        refresh()
        onComplete(true)
      }
      .onFailure { error ->
        onComplete(false)
        mutableState.update { it.copy(error = error.message ?: "分类操作失败") }
      }
    mutableState.update { it.copy(saving = false) }
  }
}
