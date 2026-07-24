package com.idickies.storing.auth

import com.idickies.storing.network.MobileSessionInfo

fun MobileSessionInfo.isCurrentDevice(currentDeviceId: String): Boolean = deviceId == currentDeviceId

fun MobileSessionInfo.canRevokeFromDeviceManager(currentDeviceId: String): Boolean =
  !isCurrentDevice(currentDeviceId) && revokedAt == null
