package com.idickies.storing.diagnostics

import android.content.Context
import android.content.Intent
import android.os.Build
import android.widget.Toast
import androidx.core.content.FileProvider
import com.idickies.storing.BuildConfig
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

object DiagnosticsExporter {

  fun export(context: Context) {
    val timestamp = SimpleDateFormat("yyyyMMdd-HHmmss", Locale.US).format(Date())
    val report = buildReport(context)
    val file = File(context.cacheDir, "diagnostics-$timestamp.txt")
    file.writeText(report)

    val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
    val intent = Intent(Intent.ACTION_SEND).apply {
      type = "text/plain"
      putExtra(Intent.EXTRA_STREAM, uri)
      putExtra(Intent.EXTRA_SUBJECT, "乾坤戒诊断信息 $timestamp")
      addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
    }
    context.startActivity(Intent.createChooser(intent, "导出诊断信息"))
    Toast.makeText(context, "诊断信息已生成，不含敏感凭据", Toast.LENGTH_SHORT).show()
  }

  private fun buildReport(context: Context): String = buildString {
    appendLine("=== 乾坤戒诊断信息 ===")
    appendLine("生成时间: ${SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).format(Date())}")
    appendLine()
    appendLine("--- 应用信息 ---")
    appendLine("应用版本: ${BuildConfig.VERSION_NAME} (${BuildConfig.VERSION_CODE})")
    appendLine("构建类型: ${BuildConfig.BUILD_TYPE}")
    appendLine("包名: ${context.packageName}")
    appendLine()
    appendLine("--- 设备信息 ---")
    appendLine("厂商: ${Build.MANUFACTURER}")
    appendLine("型号: ${Build.MODEL}")
    appendLine("品牌: ${Build.BRAND}")
    appendLine("Android 版本: ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})")
    appendLine()
    appendLine("--- 安全声明 ---")
    appendLine("本报告不包含 Token、密码、API Key 或文章正文。")
    appendLine("如需排查服务端问题，请将此报告连同设备 ID 和 App 版本号提供给管理员。")
    appendLine()
    appendLine("--- 注意事项 ---")
    appendLine("1. 导出文件已清除所有敏感信息")
    appendLine("2. 服务端日志可按 X-Storing-Device-ID 和 X-Storing-App-Version 定位")
    appendLine("3. 本文件可安全分享给开发者排查问题")
  }
}
