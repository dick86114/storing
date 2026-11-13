package com.idickies.storing.reader

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class DeepAnalysisPresentationTest {
  @Test
  fun `status presentation maps running completed and failure`() {
    assertEquals(DeepAnalysisPresentation.RUNNING, DeepAnalysisPresentation.of("running"))
    assertEquals(DeepAnalysisPresentation.DONE, DeepAnalysisPresentation.of("succeeded"))
    assertEquals(DeepAnalysisPresentation.FAILED, DeepAnalysisPresentation.of("failed"))
  }

  @Test
  fun `offline presentation blocks submission but keeps report`() {
    val presentation = DeepAnalysisPresentation.of("succeeded")
    assertTrue(presentation == DeepAnalysisPresentation.DONE)
    assertFalse(DeepAnalysisPresentation.offlineSubmitAllowed)
  }

  @Test
  fun `sheet sections match unified report contract`() {
    assertEquals(9, DeepAnalysisSheetSections.all.size)
  }
}
