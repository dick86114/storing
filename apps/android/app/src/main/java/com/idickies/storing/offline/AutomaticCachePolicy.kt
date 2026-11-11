package com.idickies.storing.offline

internal const val AUTOMATIC_CACHE_MAX_BYTES = 256L * 1024 * 1024
internal const val AUTOMATIC_CACHE_MAX_AGE_MS = 60L * 24 * 60 * 60 * 1000

/**
 * 自动缓存只使用“未固定”的条目，按最后访问时间先淘汰过期内容，
 * 再淘汰最久未访问的内容，直到总容量回到上限以内。
 */
internal fun automaticCacheEvictionIds(
  entries: List<OfflineArticle>,
  nowEpochMs: Long,
  maxBytes: Long = AUTOMATIC_CACHE_MAX_BYTES,
  maxAgeMs: Long = AUTOMATIC_CACHE_MAX_AGE_MS,
): Set<Int> {
  val automatic = entries.filterNot { it.isPinned }
  if (automatic.isEmpty()) return emptySet()

  val evicted = automatic
    .filter { nowEpochMs - it.lastAccessedAtEpochMs > maxAgeMs }
    .mapTo(mutableSetOf()) { it.articleId }

  val retained = automatic
    .filterNot { it.articleId in evicted }
    .sortedBy { it.lastAccessedAtEpochMs }
    .toMutableList()
  var totalBytes = retained.sumOf { it.totalSizeBytes }

  for (entry in retained) {
    if (totalBytes <= maxBytes) break
    evicted += entry.articleId
    totalBytes -= entry.totalSizeBytes
  }

  return evicted
}
