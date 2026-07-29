package com.idickies.storing.collect

import com.idickies.storing.network.MobileCollectJob

/** Emits only foreground transitions from an active collection job to a completed job. */
class CollectCompletionTracker {
  private var initialized = false
  private val knownStatuses = mutableMapOf<Int, String>()

  fun observe(jobs: List<MobileCollectJob>): List<MobileCollectJob> {
    val completed = if (initialized) jobs.filter { job ->
      job.status == "completed" && knownStatuses[job.id]?.let { previous -> previous != "completed" && previous != "failed" } == true
    } else emptyList()
    knownStatuses.clear()
    jobs.forEach { knownStatuses[it.id] = it.status }
    initialized = true
    return completed
  }
}
