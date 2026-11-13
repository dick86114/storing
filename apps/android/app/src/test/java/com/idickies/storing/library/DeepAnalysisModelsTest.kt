package com.idickies.storing.library

import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class DeepAnalysisModelsTest {
  private val json = Json { ignoreUnknownKeys = true }

  @Test
  fun `deep analysis summary decodes list contract`() {
    val summary = json.decodeFromString<DeepAnalysisSummary>(
      """{"hasDeepAnalysis":true,"status":"succeeded","version":2,"generatedAt":"2026-11-14T00:00:00Z","stale":true,"errorCode":null}""",
    )
    assertEquals(2, summary.version)
    assertTrue(summary.stale)
  }

  @Test
  fun `deep analysis report decodes all sections`() {
    val report = json.decodeFromString<DeepAnalysisReport>(
      """
      {"executiveSummary":"摘要","coreArguments":[{"claim":"主张","evidence":"依据","quoteAnchor":"第1段"}],
       "reasoningChain":["a","b"],"keyFacts":[{"fact":"事实","basis":"source","quoteAnchor":null}],
       "viewpoints":[{"stance":"support","summary":"支持","reasoning":"理由"}],
       "risks":["风险"],"actions":[{"action":"动作","condition":"条件"}],
       "questions":["问题"],"readingPath":["路径"]}
      """.trimIndent(),
    )
    assertEquals("第1段", report.coreArguments.single().quoteAnchor)
    assertEquals("source", report.keyFacts.single().basis)
    assertEquals("support", report.viewpoints.single().stance)
  }

  @Test
  fun `article card exposes deep analysis state`() {
    val card = ArticleCard(id = 1, deepAnalysis = DeepAnalysisSummary())
    assertEquals("not_generated", card.deepAnalysis?.status)
    assertFalse(card.deepAnalysis?.hasDeepAnalysis ?: false)
  }
}
