package com.idickies.storing.categories

import com.idickies.storing.auth.SessionStore
import com.idickies.storing.library.ArticleCategory
import com.idickies.storing.library.ArticleRepository
import com.idickies.storing.library.CategoryMutationRequest
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import javax.inject.Inject
import javax.inject.Singleton

data class CategoryCatalogState(
  val userId: Int? = null,
  val generation: Long = 0,
  val categories: List<ArticleCategory> = emptyList(),
  val counts: Map<String, Int> = emptyMap(),
  val recentCategoryIds: List<Int> = emptyList(),
  val loading: Boolean = false,
  val refreshing: Boolean = false,
  val error: String? = null,
) {
  val activeCategories: List<ArticleCategory>
    get() = activeCategories(categories)

  val recentCategories: List<ArticleCategory>
    get() {
      val byId = activeCategories.associateBy(ArticleCategory::id)
      return recentCategoryIds.mapNotNull(byId::get)
    }
}

sealed interface CategoryCreationResult {
  data class Created(val category: ArticleCategory) : CategoryCreationResult
  data class Existing(
    val category: ArticleCategory,
    val recoveredFromConflict: Boolean = false,
  ) : CategoryCreationResult
  data class Failed(val message: String) : CategoryCreationResult
}

/**
 * 全应用唯一的分类目录来源。归档导航、分类选择器和管理页都从这里派生，
 * 用户切换时递增 generation，旧请求即使晚到也不能覆盖新账号状态。
 */
@Singleton
class CategoryCatalogRepository @Inject constructor(
  private val articleRepository: ArticleRepository,
  private val sessionStore: SessionStore,
  private val recentCategoryStore: RecentCategoryStore,
) {
  private val mutableState = MutableStateFlow(CategoryCatalogState())
  val state = mutableState.asStateFlow()
  private val mutex = Mutex()

  suspend fun refresh() = mutex.withLock {
    refreshInternal()
  }

  suspend fun ensureLoaded() {
    if (mutableState.value.categories.isEmpty()) refresh()
  }

  suspend fun createCategory(rawName: String): CategoryCreationResult = mutex.withLock {
    val name = rawName.trim()
    if (!isValidCategoryName(name)) {
      return@withLock CategoryCreationResult.Failed("分类名称需为 1 至 $MAX_CATEGORY_NAME_LENGTH 个字符")
    }
    refreshForCurrentUser()
    mutableState.value.activeCategories.firstOrNull {
      it.name.trim().equals(name, ignoreCase = true)
    }?.let { return@withLock CategoryCreationResult.Existing(it) }

    val userId = refreshForCurrentUser()
    val generation = mutableState.value.generation
    return@withLock runCatching {
      articleRepository.createCategory(
        CategoryMutationRequest(name = name, color = stableCategoryColor(name)),
      ).category
    }.fold(
      onSuccess = { category ->
        if (!shouldApplyCategoryResponse(userId, generation, currentUserId(), mutableState.value.generation)) {
          return@fold CategoryCreationResult.Failed("账号已切换，请重新创建分类")
        }
        mutableState.update { current ->
          current.copy(
            categories = (current.categories + category).distinctBy(ArticleCategory::id),
            error = null,
          )
        }
        CategoryCreationResult.Created(category)
      },
      onFailure = { error ->
        val message = error.message ?: "新增分类失败"
        if (!isCategoryNameConflictMessage(message)) {
          mutableState.update { it.copy(error = message) }
          CategoryCreationResult.Failed(message)
        } else {
          refreshInternal()
          mutableState.value.activeCategories.firstOrNull {
            it.name.trim().equals(name, ignoreCase = true)
          }?.let { existing ->
            CategoryCreationResult.Existing(existing, recoveredFromConflict = true)
          } ?: CategoryCreationResult.Failed("分类已创建，但目录刷新失败，请稍后重试")
        }
      },
    )
  }

  suspend fun recordRecentCategory(categoryId: Int) = mutex.withLock {
    val userId = currentUserId()
    if (mutableState.value.activeCategories.none { it.id == categoryId }) return@withLock
    val ids = recentCategoryStore.record(userId, categoryId)
    mutableState.update { it.copy(recentCategoryIds = sanitizeRecentCategoryIds(ids, it.categories)) }
  }

  suspend fun updateCategory(id: Int, request: CategoryMutationRequest) = mutate {
    articleRepository.updateCategory(id, request)
  }

  suspend fun deleteCategory(id: Int, targetCategoryId: Int) = mutate {
    articleRepository.deleteCategory(id, targetCategoryId)
  }

  suspend fun reorderCategories(categoryIds: List<Int>) = mutate {
    articleRepository.reorderCategories(categoryIds)
  }

  suspend fun mergeCategories(sourceCategoryId: Int, targetCategoryId: Int) = mutate {
    articleRepository.mergeCategories(sourceCategoryId, targetCategoryId)
  }

  suspend fun optimizeCategoryDescription(
    request: com.idickies.storing.library.CategoryOptimizeRequest,
  ) = articleRepository.optimizeCategoryDescription(request)

  private suspend fun mutate(operation: suspend () -> Any) = mutex.withLock {
    refreshForCurrentUser()
    runCatching { operation() }
      .onSuccess { refreshInternal() }
      .onFailure { error ->
        mutableState.update { it.copy(error = error.message ?: "分类操作失败") }
        throw error
      }
  }

  private suspend fun refreshInternal() {
    val userId = refreshForCurrentUser()
    val generation = mutableState.value.generation
    mutableState.update {
      it.copy(
        loading = it.categories.isEmpty(),
        refreshing = it.categories.isNotEmpty(),
        error = null,
      )
    }
    runCatching { articleRepository.categories(includeInactive = true) }
      .onSuccess { response ->
        if (!shouldApplyCategoryResponse(userId, generation, currentUserId(), mutableState.value.generation)) return@onSuccess
        val activeIds = activeCategories(response.categories).map(ArticleCategory::id).toSet()
        val recentIds = recentCategoryStore.prune(userId, activeIds)
        mutableState.update {
          it.copy(
            categories = response.categories,
            counts = response.counts,
            recentCategoryIds = recentIds,
            loading = false,
            refreshing = false,
            error = null,
          )
        }
      }
      .onFailure { error ->
        if (!shouldApplyCategoryResponse(userId, generation, currentUserId(), mutableState.value.generation)) return@onFailure
        mutableState.update {
          it.copy(
            loading = false,
            refreshing = false,
            error = error.message ?: "加载分类失败",
          )
        }
      }
  }

  /** 在任何读写前同步当前用户，立刻丢弃上一账号的内存分类与最近使用。 */
  private fun refreshForCurrentUser(): Int {
    val userId = currentUserId()
    if (mutableState.value.userId != userId) {
      val nextGeneration = mutableState.value.generation + 1
      mutableState.value = CategoryCatalogState(
        userId = userId,
        generation = nextGeneration,
        recentCategoryIds = recentCategoryStore.read(userId),
        loading = true,
      )
    }
    return userId
  }

  private fun currentUserId(): Int = sessionStore.read()?.userId ?: 0
}
