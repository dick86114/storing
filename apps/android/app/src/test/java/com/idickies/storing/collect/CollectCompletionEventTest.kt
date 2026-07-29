package com.idickies.storing.collect

import com.idickies.storing.network.MobileCollectJob
import org.junit.Assert.assertEquals
import org.junit.Test

class CollectCompletionEventTest {
  private fun job(status: String) = MobileCollectJob(1, "https://a", "https://a", status, "capture", title = "文章")

  @Test fun `initial completed jobs do not produce foreground events`() {
    assertEquals(emptyList<MobileCollectJob>(), CollectCompletionTracker().observe(listOf(job("completed"))))
  }

  @Test fun `active to completed emits once`() {
    val tracker = CollectCompletionTracker()
    tracker.observe(listOf(job("running")))
    assertEquals(listOf(job("completed")), tracker.observe(listOf(job("completed"))))
    assertEquals(emptyList<MobileCollectJob>(), tracker.observe(listOf(job("completed"))))
  }

  @Test fun `failed terminal transition does not emit completion`() {
    val tracker = CollectCompletionTracker()
    tracker.observe(listOf(job("running")))
    assertEquals(emptyList<MobileCollectJob>(), tracker.observe(listOf(job("failed"))))
  }
}
