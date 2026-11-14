package com.idickies.storing.notification

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import com.idickies.storing.MainActivity
import com.idickies.storing.R

object DeepAnalysisNotificationHelper {
  const val channelId = "deep_analysis"
  private const val channelName = "深度报告"

  fun ensureChannel(context: Context) {
    val manager = context.getSystemService(NotificationManager::class.java)
    manager.createNotificationChannel(
      NotificationChannel(channelId, channelName, NotificationManager.IMPORTANCE_DEFAULT),
    )
  }

  fun notify(context: Context, notificationId: Int, articleId: Int, userId: Int, body: String) {
    val intent = Intent(context, MainActivity::class.java)
      .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
      .putExtra(MainActivity.EXTRA_ARTICLE_ID, articleId)
      .putExtra(MainActivity.EXTRA_DEEP_ANALYSIS_ID, notificationId)
      .putExtra(MainActivity.EXTRA_DEEP_ANALYSIS_USER_ID, userId)
    val pendingIntent = PendingIntent.getActivity(
      context,
      notificationId,
      intent,
      PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
    )
    val notification = NotificationCompat.Builder(context, channelId)
      .setSmallIcon(R.drawable.brand_logo)
      .setContentTitle("深度报告已生成")
      .setContentText(body)
      .setAutoCancel(true)
      .setContentIntent(pendingIntent)
      .build()
    context.getSystemService(NotificationManager::class.java).notify(notificationId, notification)
  }
}
