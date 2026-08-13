package com.idickies.storing.share

import org.junit.Assert.assertTrue
import org.junit.Test

class SharePosterLayoutTest {
  @Test
  fun `扫码区固定在正文安全区之后并保留底部留白`() {
    val layout = SharePosterGenerator.sharePosterLayout(3f)

    assertTrue(layout.contentBottom <= layout.qrTop - layout.sectionGap)
    assertTrue(layout.qrTop + layout.qrSize + layout.footerHeight <= layout.height)
  }

  @Test
  fun `海报使用固定的内容与扫码分区`() {
    val layout = SharePosterGenerator.sharePosterLayout(1f)

    assertTrue(layout.contentLeft < layout.contentRight)
    assertTrue(layout.coverHeight > 0)
    assertTrue(layout.qrSize > 0)
  }

  @Test
  fun `长标题场景会为摘要保留独立空间`() {
    val slots = SharePosterGenerator.posterContentSlots(
      availableHeight = 420,
      preferredCoverHeight = 220,
      summaryHeight = 120,
      sectionGap = 20,
      coverBottomGap = 24,
    )

    assertTrue(slots.summaryTop >= slots.coverBottom + 24)
    assertTrue(slots.summaryBottom <= 420)
  }
}
