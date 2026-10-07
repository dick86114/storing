package com.idickies.storing.database

import android.content.Context
import androidx.room.Database
import androidx.room.Dao
import androidx.room.Entity
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.Transaction
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase
import com.idickies.storing.library.ArticleCard
import com.idickies.storing.offline.OfflineArticle
import com.idickies.storing.offline.OfflineArticleDao

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

@Entity(tableName = "reading_positions")
data class ReadingPosition(
  @androidx.room.PrimaryKey val articleId: Int,
  val scrollPercentage: Float,
  val savedAtEpochMs: Long = System.currentTimeMillis(),
)

@Dao
interface ReadingPositionDao {
  @Query("SELECT * FROM reading_positions WHERE articleId = :articleId")
  suspend fun get(articleId: Int): ReadingPosition?

  @Insert(onConflict = androidx.room.OnConflictStrategy.REPLACE)
  suspend fun upsert(position: ReadingPosition)

  @Query("DELETE FROM reading_positions WHERE articleId = :articleId")
  suspend fun delete(articleId: Int)

  @Query("DELETE FROM reading_positions")
  suspend fun clearAll()
}

@Entity(tableName = "pending_collect_submissions")
data class PendingCollectSubmission(
  @androidx.room.PrimaryKey(autoGenerate = true) val id: Long = 0,
  val userId: Int,
  val url: String,
  val source: String,
  val createdAtEpochMs: Long = System.currentTimeMillis(),
)

@Dao
interface PendingCollectSubmissionDao {
  @Insert
  suspend fun insert(submission: PendingCollectSubmission): Long

  @Query("SELECT * FROM pending_collect_submissions WHERE userId = :userId ORDER BY id ASC LIMIT 1")
  suspend fun next(userId: Int): PendingCollectSubmission?

  @Query("DELETE FROM pending_collect_submissions WHERE id = :id")
  suspend fun delete(id: Long)
}

@Entity(tableName = "pending_auth_actions")
data class PendingAuthActionEntity(
  @androidx.room.PrimaryKey(autoGenerate = true) val id: Long = 0,
  val kind: String,
  val url: String? = null,
  val source: String? = null,
  val createdAtEpochMs: Long = System.currentTimeMillis(),
)

@Entity(
  tableName = "pending_auth_action_files",
  primaryKeys = ["actionId", "sortOrder"],
  foreignKeys = [
    androidx.room.ForeignKey(
      entity = PendingAuthActionEntity::class,
      parentColumns = ["id"],
      childColumns = ["actionId"],
      onDelete = androidx.room.ForeignKey.CASCADE,
    ),
  ],
)
data class PendingAuthActionFileEntity(
  val actionId: Long,
  val sortOrder: Int,
  val displayName: String,
  val filePath: String,
  val sizeBytes: Long,
)

data class PendingAuthActionWithFiles(
  val action: PendingAuthActionEntity,
  val files: List<PendingAuthActionFileEntity>,
)

@Dao
interface PendingAuthActionDao {
  @Insert
  suspend fun insertAction(action: PendingAuthActionEntity): Long

  @Insert
  suspend fun insertFiles(files: List<PendingAuthActionFileEntity>)

  @Query("SELECT * FROM pending_auth_actions ORDER BY id DESC LIMIT 1")
  suspend fun latestAction(): PendingAuthActionEntity?

  @Query("SELECT * FROM pending_auth_action_files WHERE actionId = :actionId ORDER BY sortOrder ASC")
  suspend fun files(actionId: Long): List<PendingAuthActionFileEntity>

  @Query("DELETE FROM pending_auth_actions")
  suspend fun clearAll()

  @Transaction
  suspend fun save(action: PendingAuthActionEntity, files: List<PendingAuthActionFileEntity>) {
    clearAll()
    val actionId = insertAction(action.copy(id = 0))
    insertFiles(files.map { it.copy(actionId = actionId) })
  }

  @Transaction
  suspend fun latestWithFiles(): PendingAuthActionWithFiles? {
    val action = latestAction() ?: return null
    return PendingAuthActionWithFiles(action, files(action.id))
  }
}

@Database(
  entities = [
    CachedArticleCard::class,
    PendingCollectSubmission::class,
    ReadingPosition::class,
    OfflineArticle::class,
    PendingAuthActionEntity::class,
    PendingAuthActionFileEntity::class,
  ],
  version = 5,
  exportSchema = false,
)
abstract class ArticleCacheDatabase : RoomDatabase() {
  abstract fun articleCacheDao(): ArticleCacheDao
  abstract fun pendingCollectSubmissionDao(): PendingCollectSubmissionDao
  abstract fun pendingAuthActionDao(): PendingAuthActionDao
  abstract fun readingPositionDao(): ReadingPositionDao
  abstract fun offlineArticleDao(): OfflineArticleDao

  companion object {
    val MIGRATION_1_2 = object : Migration(1, 2) {
      override fun migrate(database: SupportSQLiteDatabase) {
        database.execSQL(
          """
          CREATE TABLE IF NOT EXISTS pending_collect_submissions (
            id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
            userId INTEGER NOT NULL,
            url TEXT NOT NULL,
            source TEXT NOT NULL,
            createdAtEpochMs INTEGER NOT NULL
          )
          """.trimIndent(),
        )
        database.execSQL("CREATE INDEX IF NOT EXISTS index_pending_collect_submissions_userId_id ON pending_collect_submissions(userId, id)")
      }
    }

    val MIGRATION_2_3 = object : Migration(2, 3) {
      override fun migrate(database: SupportSQLiteDatabase) {
        database.execSQL("CREATE TABLE IF NOT EXISTS reading_positions (articleId INTEGER PRIMARY KEY NOT NULL, scrollPercentage REAL NOT NULL, savedAtEpochMs INTEGER NOT NULL)")
      }
    }

    val MIGRATION_3_4 = object : Migration(3, 4) {
      override fun migrate(database: SupportSQLiteDatabase) {
        database.execSQL("CREATE TABLE IF NOT EXISTS offline_articles (articleId INTEGER PRIMARY KEY NOT NULL, title TEXT NOT NULL, source TEXT, author TEXT, localHtmlPath TEXT NOT NULL, localCoverPath TEXT, imageCount INTEGER NOT NULL, totalSizeBytes INTEGER NOT NULL, status TEXT NOT NULL, errorMessage TEXT, downloadedAtEpochMs INTEGER NOT NULL)")
      }
    }

    val MIGRATION_4_5 = object : Migration(4, 5) {
      override fun migrate(database: SupportSQLiteDatabase) {
        database.execSQL(
          """
          CREATE TABLE IF NOT EXISTS pending_auth_actions (
            id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
            kind TEXT NOT NULL,
            url TEXT,
            source TEXT,
            createdAtEpochMs INTEGER NOT NULL
          )
          """.trimIndent(),
        )
        database.execSQL(
          """
          CREATE TABLE IF NOT EXISTS pending_auth_action_files (
            actionId INTEGER NOT NULL,
            sortOrder INTEGER NOT NULL,
            displayName TEXT NOT NULL,
            filePath TEXT NOT NULL,
            sizeBytes INTEGER NOT NULL,
            PRIMARY KEY(actionId, sortOrder),
            FOREIGN KEY(actionId) REFERENCES pending_auth_actions(id) ON DELETE CASCADE
          )
          """.trimIndent(),
        )
        database.execSQL("CREATE INDEX IF NOT EXISTS index_pending_auth_action_files_actionId_sortOrder ON pending_auth_action_files(actionId, sortOrder)")
      }
    }

    fun create(context: Context): ArticleCacheDatabase =
      Room.databaseBuilder(context.applicationContext, ArticleCacheDatabase::class.java, "qiankunjie_article_cache")
        .addMigrations(MIGRATION_1_2, MIGRATION_2_3, MIGRATION_3_4, MIGRATION_4_5)
        .build()
  }
}
