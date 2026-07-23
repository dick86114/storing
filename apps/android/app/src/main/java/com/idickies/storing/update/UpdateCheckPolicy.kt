package com.idickies.storing.update

object UpdateCheckPolicy {
  const val DAILY_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1_000L

  fun shouldRequest(lastCheckEpochMs: Long, nowEpochMs: Long, force: Boolean): Boolean =
    force || nowEpochMs - lastCheckEpochMs >= DAILY_CHECK_INTERVAL_MS
}
