package com.idickies.storing.auth

import com.idickies.storing.network.MobileSessionInfo
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class MobileSessionPresentationTest {
  @Test
  fun `only another device session can be revoked from the device manager`() {
    val current = MobileSessionInfo(
      id = "11111111-1111-4111-8111-111111111111",
      deviceId = "current-device",
      deviceName = "Google Pixel",
      appVersion = "1.0.4",
      expiresAt = "2026-10-22T00:00:00.000Z",
    )
    val other = current.copy(id = "22222222-2222-4222-8222-222222222222", deviceId = "other-device")

    assertTrue(current.isCurrentDevice("current-device"))
    assertFalse(current.canRevokeFromDeviceManager("current-device"))
    assertTrue(other.canRevokeFromDeviceManager("current-device"))
  }
}
