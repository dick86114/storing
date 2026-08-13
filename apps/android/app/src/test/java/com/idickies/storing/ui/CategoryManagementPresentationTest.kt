package com.idickies.storing.ui

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class CategoryManagementPresentationTest {
  @Test
  fun `移动端分类管理提供与网页一致的十二个主题预设颜色`() {
    assertEquals(12, categoryPresetColors.size)
    assertTrue(categoryPresetColors.contains("#2F6A4F"))
  }

  @Test
  fun `分类表单会提供 AI 规则优化入口`() {
    assertEquals("AI 优化", categoryAiOptimizeLabel)
  }

  @Test
  fun `分类规则说明会解释适合与不适合收录的用途`() {
    assertTrue(categoryRuleHelpText.contains("典型主题"))
    assertTrue(categoryRuleHelpText.contains("容易混淆"))
  }

  @Test
  fun `分类颜色支持预设之外的合法十六进制自定义色`() {
    assertTrue(isCategoryHexColor("#146C94"))
    assertTrue(!isCategoryHexColor("green"))
  }
}
