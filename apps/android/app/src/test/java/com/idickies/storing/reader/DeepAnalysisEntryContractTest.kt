package com.idickies.storing.reader

import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class DeepAnalysisEntryContractTest {
  private fun read(path: String): String =
    File(System.getProperty("user.dir") ?: error("缺少工作目录")).resolve(path).readText()

  @Test
  fun `reader opens the report sheet before loading remote data`() {
    val library = read("src/main/java/com/idickies/storing/ui/LibraryScreen.kt")

    assertTrue(library.contains("showDeepAnalysis = true"))
    assertTrue(library.contains("onDeepAnalysis()"))
    assertTrue(library.contains("loading = deepAnalysis.loading"))
    assertTrue(library.contains("errorMessage = deepAnalysis.errorMessage"))
  }

  @Test
  fun `reader deep report action keeps its label inside the click target`() {
    val actionBar = read("src/main/java/com/idickies/storing/ui/components/ReaderActionBar.kt")

    assertTrue(actionBar.contains(".clickable(enabled = enabled, onClick = onClick)"))
    assertTrue(actionBar.contains("Box(modifier = Modifier.size(36.dp)"))
  }

  @Test
  fun `deep report action exposes all reader states`() {
    val actionBar = read("src/main/java/com/idickies/storing/ui/components/ReaderActionBar.kt")
    val library = read("src/main/java/com/idickies/storing/ui/LibraryScreen.kt")
    val card = read("src/main/java/com/idickies/storing/ui/components/QiankunjieArticleCard.kt")

    assertTrue(actionBar.contains("ic_bubbles_sparkles_fill"))
    assertTrue(actionBar.contains("ic_sparkles_rectangle_stack"))
    assertTrue(actionBar.contains("\"生成中\""))
    assertTrue(actionBar.contains("\"解析失败\""))
    assertTrue(actionBar.contains("\"解析\""))
    assertTrue(library.contains("showDeepAnalysisFailure = true"))
    assertTrue(library.contains("重新生成"))
    assertTrue(card.contains("ic_bubbles_sparkles_fill"))
  }

  @Test
  fun `deep report sheet scrolls through every section`() {
    val sheet = read("src/main/java/com/idickies/storing/ui/DeepAnalysisReportContent.kt")

    assertTrue(sheet.contains("LazyColumn("))
    assertTrue(sheet.contains("DeepAnalysisMetrics"))
    assertTrue(sheet.contains("EvidenceCard"))
    assertTrue(sheet.contains("AiWritingCard"))
    assertTrue(sheet.contains("ReportMetadataFooter"))
  }
}
