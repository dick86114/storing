package com.idickies.storing.collect

import com.idickies.storing.network.MobileCollectJob

object CollectNotificationPolicy {
  fun shouldNotify(job: MobileCollectJob): Boolean = job.isTerminal
}
