package com.idickies.storing.reader

import com.idickies.storing.database.ReadingPosition
import com.idickies.storing.database.ReadingPositionDao
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class ReadingPositionRepository @Inject constructor(
  private val dao: ReadingPositionDao,
) {
  suspend fun get(articleId: Int): ReadingPosition? = dao.get(articleId)

  suspend fun save(articleId: Int, scrollPercentage: Float) {
    dao.upsert(ReadingPosition(articleId = articleId, scrollPercentage = scrollPercentage.coerceIn(0f, 1f)))
  }

  suspend fun delete(articleId: Int) = dao.delete(articleId)

  suspend fun clearAll() = dao.clearAll()
}
