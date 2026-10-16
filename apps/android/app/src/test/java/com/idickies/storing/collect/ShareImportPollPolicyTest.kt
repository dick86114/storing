package com.idickies.storing.collect

import org.junit.Assert.assertEquals
import org.junit.Test

class ShareImportPollPolicyTest {
  @Test
  fun `first 30 seconds keeps the fast 2s cadence`() {
    assertEquals(2_000L, ShareImportPollPolicy.intervalMillis(elapsedMillis = 0, consecutiveFailures = 0))
    assertEquals(2_000L, ShareImportPollPolicy.intervalMillis(elapsedMillis = 29_999, consecutiveFailures = 0))
  }

  @Test
  fun `after 30 seconds the cadence drops to 5s`() {
    assertEquals(5_000L, ShareImportPollPolicy.intervalMillis(elapsedMillis = 30_000, consecutiveFailures = 0))
    assertEquals(5_000L, ShareImportPollPolicy.intervalMillis(elapsedMillis = 5 * 60_000 - 1, consecutiveFailures = 0))
  }

  @Test
  fun `after 5 minutes the cadence drops to 10s`() {
    assertEquals(10_000L, ShareImportPollPolicy.intervalMillis(elapsedMillis = 5 * 60_000, consecutiveFailures = 0))
  }

  @Test
  fun `consecutive failures double the interval and cap at 30s`() {
    assertEquals(4_000L, ShareImportPollPolicy.intervalMillis(elapsedMillis = 0, consecutiveFailures = 1))
    assertEquals(8_000L, ShareImportPollPolicy.intervalMillis(elapsedMillis = 0, consecutiveFailures = 2))
    assertEquals(30_000L, ShareImportPollPolicy.intervalMillis(elapsedMillis = 0, consecutiveFailures = 9))
    assertEquals(30_000L, ShareImportPollPolicy.intervalMillis(elapsedMillis = 5 * 60_000, consecutiveFailures = 9))
  }
}
