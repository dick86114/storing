package com.idickies.storing.ui

import com.idickies.storing.categories.MAX_CATEGORY_NAME_LENGTH
import com.idickies.storing.categories.stableCategoryColor
import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import kotlinx.serialization.encodeToString
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
  fun `详细规则进入同一次创建请求的序列化字段`() {
    val request = CategoryQuickCreateDraft(
      name = "产品设计",
      description = "设计系统与交互边界",
      includeExamples = "设计系统\n交互设计",
      excludeExamples = "纯开发",
      color = "#146C94",
      colorManuallyEdited = true,
    ).toMutationRequest()
    val json = Json.encodeToString(request)

    assertTrue(json.contains("\"name\":\"产品设计\""))
    assertTrue(json.contains("\"description\":\"设计系统与交互边界\""))
    assertTrue(json.contains("\"includeExamples\":[\"设计系统\",\"交互设计\"]"))
    assertTrue(json.contains("\"excludeExamples\":[\"纯开发\"]"))
    assertTrue(json.contains("\"color\":\"#146C94\""))
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
