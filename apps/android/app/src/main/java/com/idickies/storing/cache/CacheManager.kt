package com.idickies.storing.cache

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import kotlin.math.roundToInt

object CacheManager {

  /** Human-readable size string like "12.3 MB" or "1.2 GB". */
  fun formatSize(bytes: Long): String {
    if (bytes <= 0) return "0 B"
    val units = arrayOf("B", "KB", "MB", "GB")
    var size = bytes.toDouble()
    var unitIndex = 0
    while (size >= 1024 && unitIndex < units.lastIndex) {
      size /= 1024
      unitIndex++
    }
    return if (unitIndex == 0) "${bytes} B" else "${(size * 10).roundToInt() / 10.0} ${units[unitIndex]}"
  }

  /** Total cache size: image cache directory + Room database file. */
  suspend fun totalCacheSize(context: Context): Long = withContext(Dispatchers.IO) {
    val imageCache = imageCacheSize(context)
    val dbCache = databaseSize(context)
    imageCache + dbCache
  }

  /** Clear image cache only. Preserves Room cache (article metadata, pending submissions). */
  suspend fun clearImageCache(context: Context): Long = withContext(Dispatchers.IO) {
    val freed = clearDir(context.cacheDir, "image_cache") + clearDir(context.cacheDir, "coil")
    freed
  }

  private fun imageCacheSize(context: Context): Long {
    val cacheDir = context.cacheDir
    val coilDir = File(cacheDir, "image_cache")
    val coilDir2 = File(cacheDir, "coil")
    return dirSize(coilDir) + dirSize(coilDir2)
  }

  private fun databaseSize(context: Context): Long {
    val dbFile = context.getDatabasePath("qiankunjie_article_cache")
    return dbFile?.length() ?: 0L
  }

  private fun dirSize(dir: File): Long {
    if (!dir.exists()) return 0
    var size = 0L
    val files = dir.listFiles() ?: return 0
    for (file in files) {
      size += if (file.isDirectory) dirSize(file) else file.length()
    }
    return size
  }

  private fun clearDir(parent: File, child: String): Long {
    val dir = File(parent, child)
    if (!dir.exists()) return 0
    val size = dirSize(dir)
    dir.deleteRecursively()
    return size
  }
}
