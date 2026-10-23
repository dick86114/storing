package com.idickies.storing.categories

import com.idickies.storing.library.ArticleCategory
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class CategoryCatalogPolicyTest {
  private val pending = ArticleCategory(id = 1, name = "待整理", sortOrder = 0, isSystem = true)
  private val work = ArticleCategory(id = 2, name = "工作", sortOrder = 10, color = "#2F6A4F")
  private val design = ArticleCategory(id = 3, name = "产品设计", sortOrder = 20, color = "#536CCB")
  private val inactive = ArticleCategory(id = 4, name = "旧分类", sortOrder = 30, isActive = false)

  @Test
  fun `选择器只显示启用分类且系统分类固定在前`() {
    assertEquals(
      listOf(pending, work, design),
      activeCategories(listOf(design, inactive, work, pending)),
    )
  }

  @Test
  fun `最近使用按记录顺序保留有效分类并最多五项`() {
    val categories = listOf(pending, work, design)

    assertEquals(
      listOf(design.id, work.id, pending.id),
      sanitizeRecentCategoryIds(listOf(3, 99, 2, 3, 1), categories),
    )
  }

  @Test
  fun `记录最近分类时去重前置并裁剪为五项`() {
    assertEquals(
      listOf(6, 1, 2, 3, 4),
      recordRecentCategoryId(listOf(1, 2, 3, 4, 5), 6),
    )
    assertEquals(
      listOf(3, 1, 2, 4, 5),
      recordRecentCategoryId(listOf(1, 2, 3, 4, 5), 3),
    )
  }

  @Test
  fun `搜索名称包含匹配且完全同名时优先使用现有分类`() {
    val categories = listOf(pending, work, design)

    assertEquals(listOf(design), searchCategories(categories, "设计"))
    assertEquals(CategorySearchAction.UseExisting(design), categorySearchAction(categories, "产品设计"))
    assertEquals(CategorySearchAction.UseExisting(work), categorySearchAction(categories, " 工作 "))
    assertEquals(CategorySearchAction.Create("写作"), categorySearchAction(categories, "写作"))
    assertEquals(CategorySearchAction.None, categorySearchAction(categories, "  "))
  }

  @Test
  fun `分类名称限制为四十字符且默认颜色由名称稳定生成`() {
    assertTrue(isValidCategoryName("产品设计"))
    assertFalse(isValidCategoryName(""))
    assertFalse(isValidCategoryName("名".repeat(41)))
    assertEquals(stableCategoryColor("产品设计"), stableCategoryColor("产品设计"))
    assertTrue(stableCategoryColor("产品设计").startsWith("#"))
  }

  @Test
  fun `拖拽排序只移动用户分类并保留系统分类位置`() {
    val categories = listOf(pending, work, design)

    assertEquals(
      listOf(pending.id, design.id, work.id),
      moveUserCategory(categories, movingId = work.id, targetId = design.id),
    )
    assertNull(moveUserCategory(categories, movingId = pending.id, targetId = design.id))
  }

  @Test
  fun `共享目录的最近使用只派生有效启用分类`() {
    val state = CategoryCatalogState(
      categories = listOf(pending, work, design, inactive),
      recentCategoryIds = listOf(design.id, inactive.id, work.id),
    )

    assertEquals(listOf(design, work), state.recentCategories)
  }

  @Test
  fun `最近使用缓存能容忍损坏内容并裁剪到五项`() {
    assertEquals(listOf(8, 3, 5, 1, 2), decodeRecentCategoryIds("8,oops,3,8,5,1,2"))
    assertEquals(emptyList<Int>(), decodeRecentCategoryIds("broken"))
  }

  @Test
  fun `切号或旧代际响应不会覆盖当前分类目录`() {
    assertTrue(shouldApplyCategoryResponse(7, 2, 7, 2))
    assertFalse(shouldApplyCategoryResponse(7, 2, 8, 3))
    assertFalse(shouldApplyCategoryResponse(7, 2, 7, 3))
  }

  @Test
  fun `服务端同名冲突会转换为可恢复的现有分类结果`() {
    assertTrue(isCategoryNameConflictMessage("HTTP 400 已存在同名启用分类"))
    assertTrue(isCategoryNameConflictMessage("CATEGORY_NAME_CONFLICT"))
    assertFalse(isCategoryNameConflictMessage("网络连接失败"))
  }
}
