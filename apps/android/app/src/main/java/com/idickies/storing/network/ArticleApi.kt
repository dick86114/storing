package com.idickies.storing.network

import com.idickies.storing.library.ArchiveResponse
import com.idickies.storing.library.ArticleDetail
import com.idickies.storing.library.ArticleListResponse
import com.idickies.storing.library.ToggleFavoriteResponse
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Path
import retrofit2.http.POST
import retrofit2.http.Query

interface ArticleApi {
  @GET("articles")
  suspend fun articles(
    @Query("view") view: String,
    @Query("page") page: Int = 1,
    @Query("perPage") perPage: Int = 20,
  ): ArticleListResponse

  @GET("search")
  suspend fun search(
    @Query("q") query: String,
    @Query("page") page: Int = 1,
    @Query("perPage") perPage: Int = 20,
  ): ArticleListResponse

  @GET("articles/{id}")
  suspend fun article(
    @Path("id") id: Int,
    @Query("format") format: String = "html",
    @Query("htmlVariant") htmlVariant: String = "mobile",
  ): ArticleDetail

  @POST("articles/{id}/favorite")
  suspend fun toggleFavorite(@Path("id") id: Int): ToggleFavoriteResponse

  @POST("articles/{id}/archive")
  suspend fun archive(@Path("id") id: Int): ArchiveResponse

  @POST("articles/{id}/unarchive")
  suspend fun unarchive(@Path("id") id: Int): ArchiveResponse

  @DELETE("articles/{id}")
  suspend fun delete(@Path("id") id: Int)
}
