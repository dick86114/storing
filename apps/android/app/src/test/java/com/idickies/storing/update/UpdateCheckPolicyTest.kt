package com.idickies.storing.update

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class UpdateCheckPolicyTest {
  @Test
  fun `manual checks bypass the daily automatic interval`() {
    val now = 2_000_000L
    assertFalse(UpdateCheckPolicy.shouldRequest(lastCheckEpochMs = now - 1_000, nowEpochMs = now, force = false))
    assertTrue(UpdateCheckPolicy.shouldRequest(lastCheckEpochMs = now - 1_000, nowEpochMs = now, force = true))
  }
}
