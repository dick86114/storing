package com.idickies.storing.offline

import androidx.room.Dao
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.PrimaryKey
import androidx.room.Query
import androidx.room.Transaction

enum class OfflineDownloadStatus { Downloading, Completed, Failed }

@Entity(tableName = "offline_articles")
data class OfflineArticle(
  @PrimaryKey val articleId: Int,
  val title: String,
  val source: String?,
  val author: String?,
  val localHtmlPath: String,
  val localCoverPath: String?,
  val imageCount: Int = 0,
  val totalSizeBytes: Long = 0,
  val status: String = OfflineDownloadStatus.Completed.name,
  val errorMessage: String? = null,
  val downloadedAtEpochMs: Long = System.currentTimeMillis(),
)

@Dao
interface OfflineArticleDao {
  @Query("SELECT * FROM offline_articles ORDER BY downloadedAtEpochMs DESC")
  suspend fun all(): List<OfflineArticle>

  @Query("SELECT * FROM offline_articles WHERE articleId = :articleId")
  suspend fun get(articleId: Int): OfflineArticle?

  @Query("SELECT articleId FROM offline_articles")
  suspend fun allIds(): List<Int>

  @Insert(onConflict = OnConflictStrategy.REPLACE)
  suspend fun upsert(article: OfflineArticle)

  @Query("DELETE FROM offline_articles WHERE articleId = :articleId")
  suspend fun delete(articleId: Int)

  @Query("DELETE FROM offline_articles")
  suspend fun clearAll()

  @Query("SELECT SUM(totalSizeBytes) FROM offline_articles WHERE status = 'Completed'")
  suspend fun totalSize(): Long?

  @Transaction
  suspend fun replaceAll(articles: List<OfflineArticle>) {
    clearAll()
    articles.forEach { upsert(it) }
  }
}
