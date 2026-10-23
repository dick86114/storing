package com.idickies.storing.ui

import com.idickies.storing.categories.MAX_CATEGORY_NAME_LENGTH
import com.idickies.storing.categories.stableCategoryColor
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class CategoryQuickCreateTest {
  @Test
  fun `轻量创建输入最多保留四十个字符`() {
    val draft = CategoryQuickCreateDraft().withName("名".repeat(50))

    assertEquals(MAX_CATEGORY_NAME_LENGTH, draft.name.length)
  }

  @Test
  fun `名称变化会更新稳定的默认颜色除非用户手动选择`() {
    val automatic = CategoryQuickCreateDraft().withName("工作")
    assertEquals(stableCategoryColor("工作"), automatic.color)

    val manual = automatic.copy(color = "#146C94", colorManuallyEdited = true).withName("设计")
    assertEquals("#146C94", manual.color)
  }

  @Test
  fun `只有名称是创建分类的必填字段`() {
    val request = CategoryQuickCreateDraft(name = "阅读").toMutationRequest()

    assertEquals("阅读", request.name)
    assertEquals(null, request.description)
    assertTrue(request.includeExamples.isNullOrEmpty())
    assertFalse(request.color.isNullOrBlank())
  }
}
