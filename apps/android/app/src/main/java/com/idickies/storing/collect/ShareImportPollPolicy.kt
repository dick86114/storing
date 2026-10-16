package com.idickies.storing.collect

/**
 * 分享导入排队期间的轮询节奏。
 *
 * 导入前期保持 2 秒级响应；超过 30 秒降到 5 秒档，超过 5 分钟降到 10 秒档；
 * 连续网络失败时按 2 的幂退避并封顶 30 秒，避免后台长时间高频轮询造成耗电与流量浪费。
 */
internal object ShareImportPollPolicy {
  const val FAST_INTERVAL_MILLIS = 2_000L
  const val MEDIUM_INTERVAL_MILLIS = 5_000L
  const val SLOW_INTERVAL_MILLIS = 10_000L
  const val MAX_FAILURE_INTERVAL_MILLIS = 30_000L

  fun intervalMillis(elapsedMillis: Long, consecutiveFailures: Int): Long {
    val base = when {
      elapsedMillis < 30_000L -> FAST_INTERVAL_MILLIS
      elapsedMillis < 5 * 60_000L -> MEDIUM_INTERVAL_MILLIS
      else -> SLOW_INTERVAL_MILLIS
    }
    if (consecutiveFailures <= 0) return base
    val multiplier = 1L shl consecutiveFailures.coerceAtMost(4)
    return (base * multiplier).coerceAtMost(MAX_FAILURE_INTERVAL_MILLIS)
  }
}
