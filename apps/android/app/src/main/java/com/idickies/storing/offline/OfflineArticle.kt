package com.idickies.storing.offline

import androidx.room.Dao
import androidx.room.Entity
import androidx.room.Index
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Transaction

enum class OfflineDownloadStatus { Downloading, Completed, Failed }

@Entity(
  tableName = "offline_articles",
  primaryKeys = ["userId", "articleId"],
  indices = [
    Index(value = ["userId", "isPinned"]),
    Index(value = ["userId", "lastAccessedAtEpochMs"]),
  ],
)
data class OfflineArticle(
  val articleId: Int,
  val userId: Int = 0,
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
  val isPinned: Boolean = true,
  val hasCompleteAssets: Boolean = true,
  val detailJson: String? = null,
  val cachedAtEpochMs: Long = downloadedAtEpochMs,
  val lastAccessedAtEpochMs: Long = cachedAtEpochMs,
)

@Dao
interface OfflineArticleDao {
  @Query("SELECT * FROM offline_articles WHERE userId = :userId AND isPinned = 1 ORDER BY downloadedAtEpochMs DESC")
  suspend fun pinned(userId: Int): List<OfflineArticle>

  @Query("SELECT * FROM offline_articles WHERE userId = :userId AND isPinned = 0 ORDER BY lastAccessedAtEpochMs ASC")
  suspend fun automatic(userId: Int): List<OfflineArticle>

  @Query("SELECT * FROM offline_articles WHERE userId = :userId AND articleId = :articleId")
  suspend fun get(userId: Int, articleId: Int): OfflineArticle?

  @Insert(onConflict = OnConflictStrategy.REPLACE)
  suspend fun upsert(article: OfflineArticle)

  @Query("DELETE FROM offline_articles WHERE userId = :userId AND articleId = :articleId")
  suspend fun delete(userId: Int, articleId: Int)

  @Query("DELETE FROM offline_articles WHERE userId = :userId AND isPinned = 1")
  suspend fun clearPinned(userId: Int)

  @Query("DELETE FROM offline_articles WHERE userId = :userId AND isPinned = 0")
  suspend fun clearAutomatic(userId: Int)

  @Query("SELECT SUM(totalSizeBytes) FROM offline_articles WHERE userId = :userId AND isPinned = 1 AND status = 'Completed'")
  suspend fun pinnedSize(userId: Int): Long?

  @Query("SELECT SUM(totalSizeBytes) FROM offline_articles WHERE userId = :userId AND isPinned = 0 AND status = 'Completed'")
  suspend fun automaticSize(userId: Int): Long?

  @Query("SELECT COUNT(*) FROM offline_articles WHERE userId = :userId AND isPinned = 0 AND status = 'Completed'")
  suspend fun automaticCount(userId: Int): Int

  @Query("SELECT SUM(imageCount) FROM offline_articles WHERE userId = :userId AND isPinned = 0 AND status = 'Completed'")
  suspend fun automaticImageCount(userId: Int): Int?

  @Query("UPDATE offline_articles SET imageCount = :imageCount, totalSizeBytes = :totalSizeBytes WHERE userId = :userId AND articleId = :articleId AND isPinned = 0")
  suspend fun updateAutomaticAssets(userId: Int, articleId: Int, imageCount: Int, totalSizeBytes: Long)

  @Query("UPDATE offline_articles SET lastAccessedAtEpochMs = :lastAccessedAtEpochMs WHERE userId = :userId AND articleId = :articleId")
  suspend fun touch(userId: Int, articleId: Int, lastAccessedAtEpochMs: Long)

  @Query("DELETE FROM offline_articles WHERE userId = :userId AND articleId IN (SELECT articleId FROM offline_articles WHERE userId = 0)")
  suspend fun deleteCollisionsWithLegacy(userId: Int)

  @Query("UPDATE offline_articles SET userId = :userId WHERE userId = 0")
  suspend fun assignLegacy(userId: Int)

  /**
   * 旧版本没有记录离线内容所属账号。升级后由首个登录用户认领这些条目，
   * 同时删除同文冲突的新缓存，避免复合主键更新失败。
   */
  @Transaction
  suspend fun claimLegacy(userId: Int) {
    if (userId <= 0) return
    deleteCollisionsWithLegacy(userId)
    assignLegacy(userId)
  }
}
