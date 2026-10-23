package com.idickies.storing.ui

import java.io.File
import org.junit.Assert.assertTrue
import org.junit.Test

class CategoryRefreshExperienceTest {
  @Test
  fun `归档分类使用共享目录并保留失败重试入口`() {
    val source = File("src/main/java/com/idickies/storing/ui/LibraryScreen.kt").readText()
    assertTrue(source.contains("archiveCategoriesError"))
    assertTrue(source.contains("重试分类"))
    assertTrue(source.contains("管理"))
  }

  @Test
  fun `分类选择器使用底部弹层并区分同名创建动作`() {
    val source = File("src/main/java/com/idickies/storing/ui/CategoryAssignmentSheet.kt").readText()
    assertTrue(source.contains("ModalBottomSheet"))
    assertTrue(source.contains("使用现有分类"))
    assertTrue(source.contains("创建"))
    assertTrue(source.contains("并分类"))
    assertTrue(source.contains("focusRequester.requestFocus()"))
    assertTrue(source.contains("if (submitting) return"))
    assertTrue(source.contains("resultMessage = result.message"))
    val library = File("src/main/java/com/idickies/storing/ui/LibraryScreen.kt").readText()
    assertTrue(library.contains("remainingCategoryAssignmentIds(requestedIds, result)"))
    assertTrue(library.contains("if (result.closesSheet)"))
  }

  @Test
  fun `管理页使用搜索列表详情并保护系统分类`() {
    val source = File("src/main/java/com/idickies/storing/ui/CategoryManagementScreen.kt").readText()
    assertTrue(source.contains("搜索分类"))
    assertTrue(source.contains("分类详情"))
    assertTrue(source.contains("拖动排序"))
    assertTrue(source.contains("上移"))
    assertTrue(source.contains("合并分类"))
    assertTrue(source.contains("不能编辑"))
    assertTrue(source.contains("CategoryQuickCreateFields"))
    assertTrue(source.contains("onMerge"))
  }

  @Test
  fun `分类管理保存时禁用拖拽并在删除合并弹层显示错误`() {
    val source = File("src/main/java/com/idickies/storing/ui/CategoryManagementScreen.kt").readText()
    assertTrue(source.contains("enabled = !saving"))
    assertTrue(source.contains("CategoryDeleteSheet"))
    assertTrue(source.contains("CategoryMergeSheet"))
    assertTrue(source.contains("CategoryOperationError"))
  }

  @Test
  fun `管理页创建分类只调用一次完整目录创建入口`() {
    val viewModel = File("src/main/java/com/idickies/storing/categories/CategoryManagementViewModel.kt").readText()
    assertTrue(viewModel.contains("catalog.createCategory(request)"))
    assertTrue(!viewModel.contains("catalog.updateCategory(result.category.id"))
  }

  @Test
  fun `UI Lab 固定包含分类管理与统一选择器场景`() {
    val scenarios = File("src/debug/java/com/idickies/storing/uilab/UiLabScenario.kt").readText()
    val fixtures = File("src/debug/java/com/idickies/storing/uilab/UiLabFixtures.kt").readText()
    assertTrue(scenarios.contains("CategoryPicker"))
    assertTrue(scenarios.contains("CategoryManagementError"))
    assertTrue(fixtures.contains("val categories"))
    assertTrue(fixtures.contains("val categoryCounts"))
  }
}
