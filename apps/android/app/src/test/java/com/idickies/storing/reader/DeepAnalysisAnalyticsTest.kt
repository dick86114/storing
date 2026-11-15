package com.idickies.storing.reader

import com.idickies.storing.library.DeepAnalysisAction
import com.idickies.storing.library.DeepAnalysisAiWriting
import com.idickies.storing.library.DeepAnalysisArgument
import com.idickies.storing.library.DeepAnalysisFact
import com.idickies.storing.library.DeepAnalysisReport
import com.idickies.storing.library.DeepAnalysisViewpoint
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class DeepAnalysisAnalyticsTest {
  private val report = DeepAnalysisReport(
    executiveSummary = "摘要",
    coreArguments = listOf(DeepAnalysisArgument("主张", "依据")),
    reasoningChain = listOf("先提出问题", "再给出结论"),
    keyFacts = listOf(
      DeepAnalysisFact("原文事实", "source"),
      DeepAnalysisFact("AI 推测", "inference"),
    ),
    viewpoints = listOf(
      DeepAnalysisViewpoint("support", "支持", "理由"),
      DeepAnalysisViewpoint("conditional", "有条件", "理由"),
      DeepAnalysisViewpoint("oppose", "反驳", "理由"),
    ),
    risks = listOf("风险"),
    actions = listOf(DeepAnalysisAction("行动", "条件")),
    questions = listOf("问题"),
    readingPath = listOf("路径"),
    aiWriting = DeepAnalysisAiWriting(score = 68, summary = "判断"),
  )

  @Test
  fun `analytics summarize evidence and viewpoints`() {
    val evidence = DeepAnalysisReportAnalytics.evidenceMix(report)
    val stances = DeepAnalysisReportAnalytics.stanceMix(report)

    assertEquals(1, evidence.source)
    assertEquals(1, evidence.inference)
    assertEquals(50, evidence.sourcePercent)
    assertEquals(1, stances.support)
    assertEquals(1, stances.conditional)
    assertEquals(1, stances.oppose)
    assertEquals(33, stances.supportPercent)
  }

  @Test
  fun `analytics derive readable section thoughts`() {
    val thoughts = DeepAnalysisReportAnalytics.sectionThoughts(report)

    assertTrue(thoughts.getValue(DeepAnalysisReportSection.Arguments).contains("主张"))
    assertTrue(thoughts.getValue(DeepAnalysisReportSection.Facts).contains("1 条能在原文找到依据"))
    assertTrue(thoughts.getValue(DeepAnalysisReportSection.Viewpoints).contains("支持 1 个"))
    assertEquals(DeepAnalysisAiWritingBand.Ai, DeepAnalysisReportAnalytics.aiWritingBand(68))
  }
}
