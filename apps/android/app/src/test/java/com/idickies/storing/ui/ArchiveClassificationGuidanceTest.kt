package com.idickies.storing.ui

import java.io.File
import org.junit.Assert.assertTrue
import org.junit.Test

class ArchiveClassificationGuidanceTest {
  @Test
  fun `归档弹层和空状态解释分类依赖归档`() {
    val source = File("src/main/java/com/idickies/storing/ui/LibraryScreen.kt").readText()

    assertTrue(source.contains("分类只用于归档文章。选择分类后，文章会移入「归档」"))
    assertTrue(source.contains("归档后的文章会被整理到这里，并可按分类浏览"))
  }

  @Test
  fun `分类管理顶部说明分类只作用于归档文章`() {
    val source = File("src/main/java/com/idickies/storing/ui/CategoryManagementScreen.kt").readText()

    assertTrue(source.contains("分类只用于组织已归档文章"))
    assertTrue(source.contains("文章归档时即可选择分类"))
  }
}
