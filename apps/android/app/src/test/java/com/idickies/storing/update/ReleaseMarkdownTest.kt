package com.idickies.storing.update

import org.junit.Assert.assertEquals
import org.junit.Test

class ReleaseMarkdownTest {
  @Test
  fun `GitHub Release Markdown 转为可读的富文本段落`() {
    val markdown = """## 本次更新

* 支持 **进度条**
* 修复 `安装包` 问题
""".trimIndent()

    assertEquals(
      listOf(
        ReleaseMarkdownBlock.Heading("本次更新", 2),
        ReleaseMarkdownBlock.Bullet("支持 进度条"),
        ReleaseMarkdownBlock.Bullet("修复 安装包 问题"),
      ),
      parseReleaseMarkdown(markdown),
    )
  }
}
