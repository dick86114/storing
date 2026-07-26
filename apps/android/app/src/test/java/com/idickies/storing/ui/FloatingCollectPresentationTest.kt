package com.idickies.storing.ui

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class FloatingCollectPresentationTest {
  @Test
  fun `floating collect button is only visible for signed-in users who enable it`() {
    assertTrue(shouldShowFloatingCollectButton(isAuthenticated = true, settingEnabled = true))
    assertFalse(shouldShowFloatingCollectButton(isAuthenticated = false, settingEnabled = true))
    assertFalse(shouldShowFloatingCollectButton(isAuthenticated = true, settingEnabled = false))
  }
}
