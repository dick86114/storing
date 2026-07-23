package com.idickies.storing

import android.app.Application
import com.idickies.storing.notification.CollectNotificationHelper
import dagger.hilt.android.HiltAndroidApp

@HiltAndroidApp
class QiankunjieApplication : Application() {
  override fun onCreate() {
    super.onCreate()
    CollectNotificationHelper.ensureChannel(this)
  }
}
