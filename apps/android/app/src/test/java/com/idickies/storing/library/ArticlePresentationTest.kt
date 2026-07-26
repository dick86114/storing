package com.idickies.storing.library

import org.junit.Assert.assertEquals
import org.junit.Test

class ArticlePresentationTest {
  @Test
  fun `bottom navigation spells out the inbox label`() {
    assertEquals("收件箱", LibraryView.Inbox.shortLabel)
  }

  @Test
  fun `article cards prefer a real title and fall back to source or an untitled label`() {
    assertEquals("有标题", ArticleCard(id = 1, title = " 有标题 ").displayTitle)
    assertEquals("example.com", ArticleCard(id = 2, title = null, source = "example.com").displayTitle)
    assertEquals("未命名文章", ArticleCard(id = 3, title = " ", source = null).displayTitle)
  }
}
