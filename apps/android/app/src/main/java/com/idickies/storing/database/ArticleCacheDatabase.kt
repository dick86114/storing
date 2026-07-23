package com.idickies.storing.database

import androidx.room.Database
import androidx.room.Dao
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.RoomDatabase
import androidx.room.Transaction
import com.idickies.storing.library.ArticleCard

@Entity(tableName = "article_card_cache", primaryKeys = ["userId", "view", "id"])
data class CachedArticleCard(
  val userId: Int,
  val view: String,
  val id: Int,
  val title: String? = null,
  val author: String? = null,
  val source: String? = null,
  val originalUrl: String? = null,
  val coverImage: String? = null,
  val aiSummary: String? = null,
  val aiCategory: String? = null,
  val isFavorited: Boolean = false,
  val isArchived: Boolean = false,
  val isPublished: Boolean = false,
) {
  fun toArticleCard() = ArticleCard(
    id = id,
    title = title,
    author = author,
    source = source,
    originalUrl = originalUrl,
    coverImage = coverImage,
    aiSummary = aiSummary,
    aiCategory = aiCategory,
    isFavorited = isFavorited,
    isArchived = isArchived,
    isPublished = isPublished,
  )
}

fun ArticleCard.toCached(userId: Int, view: String) = CachedArticleCard(
  userId = userId, view = view, id = id, title = title, author = author, source = source,
  originalUrl = originalUrl, coverImage = coverImage, aiSummary = aiSummary, aiCategory = aiCategory,
  isFavorited = isFavorited, isArchived = isArchived, isPublished = isPublished,
)

@Dao
interface ArticleCacheDao {
  @Query("SELECT * FROM article_card_cache WHERE userId = :userId AND view = :view ORDER BY id DESC")
  suspend fun cards(userId: Int, view: String): List<CachedArticleCard>

  @Insert(onConflict = OnConflictStrategy.REPLACE)
  suspend fun insertAll(cards: List<CachedArticleCard>)

  @Query("DELETE FROM article_card_cache WHERE userId = :userId AND view = :view")
  suspend fun deleteView(userId: Int, view: String)

  @Transaction
  suspend fun replace(userId: Int, view: String, cards: List<CachedArticleCard>) {
    deleteView(userId, view)
    insertAll(cards)
  }

  @Query("DELETE FROM article_card_cache WHERE userId = :userId")
  suspend fun clearUser(userId: Int)
}

@Database(entities = [CachedArticleCard::class], version = 1, exportSchema = false)
abstract class ArticleCacheDatabase : RoomDatabase() {
  abstract fun articleCacheDao(): ArticleCacheDao
}
