package com.idickies.storing.collect

import com.idickies.storing.network.MobileCollectJob
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class CollectNotificationPolicyTest {
  @Test
  fun `only terminal collection jobs produce a user notification`() {
    fun job(status: String) = MobileCollectJob(id = 8, url = "https://example.com", normalizedUrl = "https://example.com", status = status, stage = "queued")
    assertFalse(CollectNotificationPolicy.shouldNotify(job("pending")))
    assertFalse(CollectNotificationPolicy.shouldNotify(job("running")))
    assertTrue(CollectNotificationPolicy.shouldNotify(job("completed")))
    assertTrue(CollectNotificationPolicy.shouldNotify(job("failed")))
  }
}
