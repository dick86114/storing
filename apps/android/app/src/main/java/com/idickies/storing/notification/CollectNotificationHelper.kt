package com.idickies.storing.notification

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat
import com.idickies.storing.MainActivity
import com.idickies.storing.R
import com.idickies.storing.network.MobileCollectJob

object CollectNotificationHelper {
  const val channelId = "collect_jobs"
  private const val channelName = "采集任务"

  fun ensureChannel(context: Context) {
    val manager = context.getSystemService(NotificationManager::class.java)
    manager.createNotificationChannel(NotificationChannel(channelId, channelName, NotificationManager.IMPORTANCE_DEFAULT))
  }

  fun notify(context: Context, job: MobileCollectJob) {
    if (android.os.Build.VERSION.SDK_INT >= 33 && ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) return
    val intent = Intent(context, MainActivity::class.java)
      .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP or Intent.FLAG_ACTIVITY_SINGLE_TOP)
      .putExtra(MainActivity.EXTRA_ARTICLE_ID, job.articleId ?: -1)
    val pendingIntent = PendingIntent.getActivity(context, job.id, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    val succeeded = job.status == "completed"
    val title = if (succeeded) "采集完成" else "采集失败"
    val content = if (succeeded) job.title ?: job.normalizedUrl else job.errorSummary ?: job.title ?: job.normalizedUrl
    val notification = NotificationCompat.Builder(context, channelId)
      .setSmallIcon(android.R.drawable.stat_notify_sync)
      .setContentTitle(title)
      .setContentText(content)
      .setAutoCancel(true)
      .setContentIntent(pendingIntent)
      .build()
    context.getSystemService(NotificationManager::class.java).notify(job.id, notification)
  }
}
