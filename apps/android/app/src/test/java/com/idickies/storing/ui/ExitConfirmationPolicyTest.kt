package com.idickies.storing.ui

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ExitConfirmationPolicyTest {
  @Test
  fun `root screen requires confirmation before the app exits`() {
    assertTrue(ExitConfirmationPolicy.requiresConfirmation(isRootScreen = true))
    assertFalse(ExitConfirmationPolicy.requiresConfirmation(isRootScreen = false))
  }
}
