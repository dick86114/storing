package com.idickies.storing.ui

import org.junit.Assert.assertEquals
import org.junit.Test

class ExitConfirmationPolicyTest {
  @Test
  fun `first system back shows a hint and second back inside the time window exits`() {
    assertEquals(ExitRequestAction.ShowHint, ExitConfirmationPolicy.action(lastBackAtMillis = null, nowMillis = 1_000L))
    assertEquals(ExitRequestAction.Exit, ExitConfirmationPolicy.action(lastBackAtMillis = 1_000L, nowMillis = 2_800L))
  }

  @Test
  fun `back after the time window starts a new exit confirmation sequence`() {
    assertEquals(ExitRequestAction.ShowHint, ExitConfirmationPolicy.action(lastBackAtMillis = 1_000L, nowMillis = 3_001L))
  }
}
