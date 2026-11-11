package com.idickies.storing.offline

import org.junit.Assert.assertEquals
import org.junit.Test

class AutomaticCachePolicyTest {
  private fun entry(
    articleId: Int,
    lastAccessedAtEpochMs: Long,
    totalSizeBytes: Long,
    isPinned: Boolean = false,
  ) = OfflineArticle(
    articleId = articleId,
    userId = 1,
    title = "文章 $articleId",
    source = "测试",
    author = null,
    localHtmlPath = "/tmp/$articleId.html",
    localCoverPath = null,
    totalSizeBytes = totalSizeBytes,
    isPinned = isPinned,
    cachedAtEpochMs = lastAccessedAtEpochMs,
    lastAccessedAtEpochMs = lastAccessedAtEpochMs,
  )

  @Test
  fun `过期自动缓存会被淘汰但固定离线保存保留`() {
    val now = 10_000L
    val ids = automaticCacheEvictionIds(
      entries = listOf(
        entry(articleId = 1, lastAccessedAtEpochMs = 1_000L, totalSizeBytes = 10L),
        entry(articleId = 2, lastAccessedAtEpochMs = 1_000L, totalSizeBytes = 10L, isPinned = true),
      ),
      nowEpochMs = now,
      maxAgeMs = 5_000L,
      maxBytes = 1_000L,
    )

    assertEquals(setOf(1), ids)
  }

  @Test
  fun `超出容量时优先淘汰最久未访问的自动缓存`() {
    val ids = automaticCacheEvictionIds(
      entries = listOf(
        entry(articleId = 1, lastAccessedAtEpochMs = 900L, totalSizeBytes = 60L),
        entry(articleId = 2, lastAccessedAtEpochMs = 950L, totalSizeBytes = 60L),
        entry(articleId = 3, lastAccessedAtEpochMs = 990L, totalSizeBytes = 60L),
      ),
      nowEpochMs = 1_000L,
      maxAgeMs = 1_000_000L,
      maxBytes = 100L,
    )

    assertEquals(setOf(1, 2), ids)
  }

  @Test
  fun `未超限时不会淘汰自动缓存`() {
    val ids = automaticCacheEvictionIds(
      entries = listOf(
        entry(articleId = 1, lastAccessedAtEpochMs = 900L, totalSizeBytes = 40L),
        entry(articleId = 2, lastAccessedAtEpochMs = 950L, totalSizeBytes = 40L),
      ),
      nowEpochMs = 1_000L,
      maxAgeMs = 1_000_000L,
      maxBytes = 100L,
    )

    assertEquals(emptySet<Int>(), ids)
  }
}
