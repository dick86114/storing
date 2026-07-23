package com.idickies.storing.collect

import com.idickies.storing.network.MobileCollectJob
import org.junit.Assert.assertEquals
import org.junit.Test

class CollectJobsUiStateTest {
  @Test
  fun `active job count excludes terminal collection jobs`() {
    val state = CollectJobsUiState(
      jobs = listOf(
        MobileCollectJob(id = 1, url = "https://a.example", normalizedUrl = "https://a.example", status = "running", stage = "capture"),
        MobileCollectJob(id = 2, url = "https://b.example", normalizedUrl = "https://b.example", status = "completed", stage = "done"),
        MobileCollectJob(id = 3, url = "https://c.example", normalizedUrl = "https://c.example", status = "pending", stage = "queued"),
      ),
    )
    assertEquals(2, state.activeJobCount)
  }
}
