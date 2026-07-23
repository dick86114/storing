package com.idickies.storing.auth

import android.content.Context
import android.os.Build
import com.idickies.storing.BuildConfig
import java.util.UUID

private const val DEVICE_PREFS = "qiankunjie_device"
private const val DEVICE_ID_KEY = "installation_id"

data class DeviceIdentity(
  val deviceId: String,
  val deviceName: String,
  val appVersion: String,
)

class DeviceIdentityProvider(context: Context) {
  private val prefs = context.getSharedPreferences(DEVICE_PREFS, Context.MODE_PRIVATE)

  fun current(): DeviceIdentity {
    val deviceId = prefs.getString(DEVICE_ID_KEY, null)
      ?: UUID.randomUUID().toString().also { prefs.edit().putString(DEVICE_ID_KEY, it).apply() }
    val deviceName = listOfNotNull(Build.MANUFACTURER, Build.MODEL)
      .joinToString(" ")
      .trim()
      .take(128)
      .ifBlank { "Android device" }
    return DeviceIdentity(deviceId, deviceName, BuildConfig.VERSION_NAME)
  }
}
