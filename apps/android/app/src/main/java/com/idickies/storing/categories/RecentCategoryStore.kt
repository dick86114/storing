package com.idickies.storing.categories

import android.content.Context
import androidx.core.content.edit
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class RecentCategoryStore @Inject constructor(
  @ApplicationContext context: Context,
) {
  private val preferences = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)

  fun read(userId: Int): List<Int> = decodeRecentCategoryIds(preferences.getString(key(userId), null))

  fun record(userId: Int, categoryId: Int): List<Int> {
    val updated = recordRecentCategoryId(read(userId), categoryId)
    write(userId, updated)
    return updated
  }

  fun prune(userId: Int, activeIds: Set<Int>): List<Int> {
    val updated = read(userId).filter(activeIds::contains).distinct().take(MAX_RECENT_CATEGORIES)
    write(userId, updated)
    return updated
  }

  private fun write(userId: Int, ids: List<Int>) {
    preferences.edit { putString(key(userId), ids.joinToString(",")) }
  }

  private fun key(userId: Int) = "recent_categories_v1_$userId"

  companion object {
    private const val PREFERENCES_NAME = "category_display_state"
  }
}

internal fun decodeRecentCategoryIds(raw: String?): List<Int> =
  raw.orEmpty().split(',').mapNotNull(String::toIntOrNull).distinct().take(MAX_RECENT_CATEGORIES)
