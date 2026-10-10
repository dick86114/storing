package com.idickies.storing.library

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.net.Uri
import android.os.Environment
import android.provider.MediaStore
import androidx.core.app.NotificationCompat
import com.idickies.storing.ApiConfiguration
import com.idickies.storing.R
import dagger.hilt.android.qualifiers.ApplicationContext
import java.io.IOException
import javax.inject.Inject
import okhttp3.Request

interface BulkExportDownloader {
  suspend fun download(job: ArticleBulkExportJob): Uri
}

internal fun bulkExportFileName(job: ArticleBulkExportJob): String =
  "storing-bulk-export-${job.id}.zip"

class MediaStoreBulkExportDownloader @Inject constructor(
  @ApplicationContext private val context: Context,
  private val client: okhttp3.OkHttpClient,
) : BulkExportDownloader {
  override suspend fun download(job: ArticleBulkExportJob): Uri {
    val relativePath = job.downloadUrl ?: throw IOException("导出文件尚未生成")
    val url = ApiConfiguration.baseUrl.trimEnd('/') + if (relativePath.startsWith("/")) relativePath else "/$relativePath"
    val response = client.newCall(Request.Builder().url(url).build()).execute()

    response.use { httpResponse ->
      if (!httpResponse.isSuccessful) throw IOException("导出文件下载失败")
      val body = httpResponse.body ?: throw IOException("导出文件内容为空")
      val values = android.content.ContentValues().apply {
        put(MediaStore.Downloads.DISPLAY_NAME, bulkExportFileName(job))
        put(MediaStore.Downloads.MIME_TYPE, "application/zip")
        put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
        put(MediaStore.Downloads.IS_PENDING, 1)
      }
      val resolver = context.contentResolver
      val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
        ?: throw IOException("无法创建下载文件")

      try {
        resolver.openOutputStream(uri)?.use { output ->
          body.byteStream().use { input -> input.copyTo(output) }
        } ?: throw IOException("无法写入下载文件")
        values.clear()
        values.put(MediaStore.Downloads.IS_PENDING, 0)
        resolver.update(uri, values, null, null)
        notifySuccess(job)
        return uri
      } catch (error: IOException) {
        resolver.delete(uri, null, null)
        throw error
      }
    }
  }

  private fun notifySuccess(job: ArticleBulkExportJob) {
    val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val channelId = "bulk_export"
    manager.createNotificationChannel(
      NotificationChannel(channelId, "批量导出", NotificationManager.IMPORTANCE_DEFAULT),
    )
    val notification = NotificationCompat.Builder(context, channelId)
      .setSmallIcon(R.drawable.ic_qiankunjie_mark)
      .setContentTitle("批量导出完成")
      .setContentText("已保存 ${bulkExportFileName(job)}")
      .setAutoCancel(true)
      .build()
    manager.notify(job.id, notification)
  }
}
