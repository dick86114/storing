package com.idickies.storing.collect

import org.junit.Assert.assertEquals
import org.junit.Assert.assertThrows
import org.junit.Test

class ActiveCollectJobsPresentationTest {
  @Test
  fun `single active job uses a focused task summary`() {
    assertEquals(
      ActiveCollectJobsPresentation(
        countLabel = "1",
        title = "正在采集",
        detail = "一条内容正在处理，完成后会自动进入收件箱",
      ),
      activeCollectJobsPresentation(1),
    )
  }

  @Test
  fun `multiple active jobs state their total and preserve inbox destination`() {
    assertEquals(
      ActiveCollectJobsPresentation(
        countLabel = "3",
        title = "正在采集",
        detail = "3 条内容正在处理，完成后会自动进入收件箱",
      ),
      activeCollectJobsPresentation(3),
    )
  }

  @Test
  fun `active task presentation rejects a non active count`() {
    assertThrows(IllegalArgumentException::class.java) { activeCollectJobsPresentation(0) }
  }
}
