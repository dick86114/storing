package com.idickies.storing.network

import com.idickies.storing.library.ArchiveResponse
import com.idickies.storing.library.ArticleArchiveRequest
import com.idickies.storing.library.ArticleRefetchResponse
import com.idickies.storing.library.ArticleRegenerateAiResponse
import com.idickies.storing.library.ArticleDetail
import com.idickies.storing.library.ArticleCategoryAssignmentRequest
import com.idickies.storing.library.ArticleCategoryAssignmentResponse
import com.idickies.storing.library.ArticleBulkCategoryRequest
import com.idickies.storing.library.ArticleBulkCategoryResponse
import com.idickies.storing.library.ArticleBulkClassifyRequest
import com.idickies.storing.library.ArticleBulkClassifyResponse
import com.idickies.storing.library.CategoryDeleteResponse
import com.idickies.storing.library.CategoryMutationRequest
import com.idickies.storing.library.CategoryMutationResponse
import com.idickies.storing.library.CategoryReorderRequest
import com.idickies.storing.library.CategoryReorderResponse
import com.idickies.storing.library.CategoryOptimizeRequest
import com.idickies.storing.library.CategoryOptimizeResponse
import com.idickies.storing.library.ArticleClassifyResponse
import com.idickies.storing.library.ArticleListResponse
import com.idickies.storing.library.ArticleSource
import com.idickies.storing.library.ArticleTag
import com.idickies.storing.library.ArchiveCategoriesResponse
import com.idickies.storing.library.PublicArticleResponse
import com.idickies.storing.library.PublicationResponse
import com.idickies.storing.library.ToggleFavoriteResponse
import com.idickies.storing.network.ArticleCounts
import retrofit2.http.DELETE
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.PATCH
import retrofit2.http.Path
import retrofit2.http.POST
import retrofit2.http.Query

interface ArticleApi {
  @GET("articles")
  suspend fun articles(
    @Query("view") view: String,
    @Query("page") page: Int = 1,
    @Query("perPage") perPage: Int = 20,
    @Query("sort") sort: String? = null,
    @Query("order") order: String = "desc",
    @Query("category") categories: List<String>? = null,
    @Query("categoryId") categoryId: Int? = null,
    @Query("tag") tags: List<String>? = null,
  ): ArticleListResponse

  @GET("sources")
  suspend fun sources(): List<ArticleSource>

  @GET("categories")
  suspend fun categories(@Query("includeInactive") includeInactive: Boolean = false): ArchiveCategoriesResponse

  @POST("categories")
  suspend fun createCategory(@Body request: CategoryMutationRequest): CategoryMutationResponse

  @PATCH("categories/{id}")
  suspend fun updateCategory(@Path("id") id: Int, @Body request: CategoryMutationRequest): CategoryMutationResponse

  @DELETE("categories/{id}")
  suspend fun deleteCategory(@Path("id") id: Int, @Query("targetCategoryId") targetCategoryId: Int): CategoryDeleteResponse

  @POST("categories/reorder")
  suspend fun reorderCategories(@Body request: CategoryReorderRequest): CategoryReorderResponse

  @POST("categories/optimize-description")
  suspend fun optimizeCategoryDescription(@Body request: CategoryOptimizeRequest): CategoryOptimizeResponse

  @GET("tags")
  suspend fun tags(): List<ArticleTag>

  @GET("search")
  suspend fun search(
    @Query("q") query: String,
    @Query("page") page: Int = 1,
    @Query("perPage") perPage: Int = 20,
  ): ArticleListResponse

  @GET("publications/{publicId}")
  suspend fun publication(@Path("publicId") publicId: String): PublicArticleResponse

  @GET("articles/{id}")
  suspend fun article(
    @Path("id") id: Int,
    @Query("format") format: String = "html",
    @Query("htmlVariant") htmlVariant: String = "mobile",
  ): ArticleDetail

  @POST("articles/{id}/favorite")
  suspend fun toggleFavorite(@Path("id") id: Int): ToggleFavoriteResponse

  @POST("articles/{id}/archive")
  suspend fun archive(@Path("id") id: Int, @Body request: ArticleArchiveRequest? = null): ArchiveResponse

  @POST("articles/{id}/unarchive")
  suspend fun unarchive(@Path("id") id: Int): ArchiveResponse

  @PATCH("articles/{id}/category")
  suspend fun moveToCategory(
    @Path("id") id: Int,
    @Body request: ArticleCategoryAssignmentRequest,
  ): ArticleCategoryAssignmentResponse

  @POST("articles/bulk-category")
  suspend fun moveToCategoryBulk(@Body request: ArticleBulkCategoryRequest): ArticleBulkCategoryResponse

  @POST("articles/{id}/classify")
  suspend fun classify(@Path("id") id: Int): ArticleClassifyResponse

  @POST("articles/bulk-classify")
  suspend fun classifyBulk(@Body request: ArticleBulkClassifyRequest): ArticleBulkClassifyResponse

  @POST("articles/{id}/publish")
  suspend fun publish(@Path("id") id: Int): PublicationResponse

  @POST("articles/{id}/unpublish")
  suspend fun unpublish(@Path("id") id: Int): PublicationResponse

  @POST("articles/{id}/refetch")
  suspend fun refetch(@Path("id") id: Int): ArticleRefetchResponse

  @POST("articles/{id}/regenerate-ai")
  suspend fun regenerateAi(@Path("id") id: Int): ArticleRegenerateAiResponse

  @DELETE("articles/{id}")
  suspend fun delete(@Path("id") id: Int)

  @DELETE("articles/{id}/permanent")
  suspend fun deletePermanent(@Path("id") id: Int): PermanentDeleteResponse

  @GET("counts")
  suspend fun counts(): ArticleCounts
}
