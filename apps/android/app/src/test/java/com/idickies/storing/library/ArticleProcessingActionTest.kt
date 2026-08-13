package com.idickies.storing.library

import org.junit.Assert.assertEquals
import org.junit.Test

class ArticleProcessingActionTest {
  @Test
  fun `article processing actions provide distinct confirmation copy`() {
    assertEquals("重新抓取", ArticleProcessingAction.Refetch.label)
    assertEquals("重新生成 AI", ArticleProcessingAction.RegenerateAi.label)
    assertEquals("重新判断分类", ArticleProcessingAction.ReclassifyCategory.label)
    assertEquals("重新抓取会覆盖", ArticleProcessingAction.Refetch.confirmationLead)
    assertEquals("不会重新抓取原文", ArticleProcessingAction.RegenerateAi.confirmationLead)
    assertEquals("不会重新生成摘要或标签", ArticleProcessingAction.ReclassifyCategory.confirmationLead)
  }
}
