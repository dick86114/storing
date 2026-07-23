package com.idickies.storing.update

import android.content.Context
import android.content.Intent
import androidx.core.content.FileProvider
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import java.io.File
import java.security.MessageDigest
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class UpdateInstaller @Inject constructor(
  private val client: OkHttpClient,
  @ApplicationContext private val context: Context,
) {
  suspend fun downloadVerifyAndInstall(release: AndroidRelease) = withContext(Dispatchers.IO) {
    val updateDirectory = File(context.cacheDir, "updates").apply { mkdirs() }
    val output = File(updateDirectory, "qiankunjie-${release.versionCode}.apk")
    val digest = MessageDigest.getInstance("SHA-256")
    client.newCall(Request.Builder().url(release.apkUrl).build()).execute().use { response ->
      if (!response.isSuccessful) throw IllegalStateException("下载更新失败：HTTP ${response.code}")
      val body = response.body ?: throw IllegalStateException("下载更新失败：响应为空")
      body.byteStream().use { input ->
        output.outputStream().use { destination ->
          val buffer = ByteArray(DEFAULT_BUFFER_SIZE)
          while (true) {
            val count = input.read(buffer)
            if (count < 0) break
            digest.update(buffer, 0, count)
            destination.write(buffer, 0, count)
          }
        }
      }
    }
    if (!digest.digest().joinToString("") { "%02x".format(it) }.equals(release.sha256, ignoreCase = true)) {
      output.delete()
      throw IllegalStateException("下载包校验失败，已拒绝安装")
    }
    val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", output)
    context.startActivity(
      Intent(Intent.ACTION_VIEW)
        .setDataAndType(uri, "application/vnd.android.package-archive")
        .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION or Intent.FLAG_ACTIVITY_NEW_TASK),
    )
  }
}
