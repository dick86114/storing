package com.idickies.storing.collect

import com.idickies.storing.network.MobileCollectJob
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MobileCollectJobTest {
  @Test
  fun `only completed and failed collection jobs are terminal`() {
    fun job(status: String) = MobileCollectJob(id = 1, url = "https://example.com", normalizedUrl = "https://example.com", status = status, stage = "queued")
    assertFalse(job("pending").isTerminal)
    assertFalse(job("running").isTerminal)
    assertTrue(job("completed").isTerminal)
    assertTrue(job("failed").isTerminal)
  }
}
