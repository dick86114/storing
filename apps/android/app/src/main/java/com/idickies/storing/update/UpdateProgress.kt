package com.idickies.storing.update

enum class UpdateStage {
  DOWNLOADING,
  VERIFYING,
  INSTALLING,
}

fun downloadProgressFraction(bytesRead: Long, totalBytes: Long): Float? =
  if (totalBytes > 0L) (bytesRead.toFloat() / totalBytes.toFloat()).coerceIn(0f, 1f) else null

fun updateStageLabel(stage: UpdateStage, fraction: Float = 0f): Pair<UpdateStage, String> = when (stage) {
  UpdateStage.DOWNLOADING -> stage to "下载更新 ${(fraction.coerceIn(0f, 1f) * 100).toInt()}%"
  UpdateStage.VERIFYING -> stage to "正在校验安装包…"
  UpdateStage.INSTALLING -> stage to "正在打开系统安装器…"
}
