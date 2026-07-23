package com.idickies.storing.collect

import java.io.IOException

object PendingCollectSubmissionPolicy {
  fun shouldQueue(error: Throwable): Boolean = error is IOException
}
