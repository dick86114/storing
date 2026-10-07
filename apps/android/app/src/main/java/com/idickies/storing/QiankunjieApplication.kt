package com.idickies.storing

import android.app.Application
import com.idickies.storing.notification.CollectNotificationHelper
import dagger.hilt.android.HiltAndroidApp
import androidx.hilt.work.HiltWorkerFactory
import androidx.work.Configuration
import javax.inject.Inject

@HiltAndroidApp
class QiankunjieApplication : Application(), Configuration.Provider {
  @Inject
  lateinit var hiltWorkerFactory: HiltWorkerFactory

  override val workManagerConfiguration: Configuration
    get() = Configuration.Builder().setWorkerFactory(hiltWorkerFactory).build()

  override fun onCreate() {
    super.onCreate()
    CollectNotificationHelper.ensureChannel(this)
  }
}
