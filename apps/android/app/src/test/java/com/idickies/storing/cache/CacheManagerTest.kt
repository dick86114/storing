package com.idickies.storing.cache

import org.junit.Assert.assertEquals
import org.junit.Test

class CacheManagerTest {

  @Test
  fun `formatSize handles zero and small sizes`() {
    assertEquals("0 B", CacheManager.formatSize(0))
    assertEquals("512 B", CacheManager.formatSize(512))
    assertEquals("1.0 KB", CacheManager.formatSize(1024))
  }

  @Test
  fun `formatSize formats megabytes and gigabytes`() {
    assertEquals("1.0 MB", CacheManager.formatSize(1024 * 1024L))
    assertEquals("1.5 MB", CacheManager.formatSize(1024 * 1024L + 512 * 1024))
    assertEquals("1.0 GB", CacheManager.formatSize(1024 * 1024 * 1024L))
  }
}
