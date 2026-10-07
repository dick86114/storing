package com.idickies.storing.collect

import java.io.File
import org.junit.Assert.assertTrue
import org.junit.Assert.assertFalse
import org.junit.Test

class CollectWorkerAuthenticationTest {
  @Test
  fun `后台采集不再自行刷新令牌`() {
    for (name in listOf("CollectTrackingWorker.kt", "PendingCollectSubmissionWorker.kt")) {
      val code = File("src/main/java/com/idickies/storing/collect/$name").readText()
      assertFalse(code.contains("MobileRefreshRequest"))
      assertFalse(code.contains("MobileAuthApi"))
      assertTrue(code.contains("MobileSessionAuthenticator"))
    }
  }

  @Test
  fun `认证失败与网络失败都会保留任务重试`() {
    for (name in listOf("CollectTrackingWorker.kt", "PendingCollectSubmissionWorker.kt")) {
      val code = File("src/main/java/com/idickies/storing/collect/$name").readText()
      assertTrue(code.contains("MobileAuthResult.Offline, MobileAuthResult.AuthenticationRequired -> return Result.retry()"))
    }
  }
}
