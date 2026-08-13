package com.idickies.storing.uilab

import com.idickies.storing.library.ArticleCard
import com.idickies.storing.library.ArticleDetail

internal object UiLabFixtures {
  val library = listOf(
    ArticleCard(id = 1, title = "在信息洪流中建立一套真正可长期使用的个人知识系统", source = "少数派", originalUrl = "https://sspai.com", author = "12 分钟阅读", aiSummary = "从采集、整理到再次发现，关键不在于收藏得更多，而是让内容在需要时重新出现。", aiTags = listOf("知识管理", "长期主义")),
    ArticleCard(id = 2, title = "为什么好的移动端阅读体验应该把注意力还给正文", source = "Storing Design Notes", originalUrl = "https://openai.com", aiSummary = "真正的阅读器不该像网页缩小版，而应该在排版、留白和操作密度之间建立克制的平衡。", aiTags = listOf("阅读", "产品设计")),
    ArticleCard(id = 3, title = "来自系统分享的一条长标题示例，用于验证两行截断、卡片高度和标签换行表现", source = "微信公众号", originalUrl = "https://mp.weixin.qq.com/s/example", aiSummary = "这是固定的 UI Lab 演示数据，不包含真实账号、链接或采集正文。", aiTags = listOf("分享采集")),
  )

  const val readerTitle = "把真正重要的内容留下来：从稍后读到个人知识空间"
  const val readerSummary = "这是一段固定摘要，用来验证标题、摘要卡片、正文节奏、图片占位和操作栏在不同屏幕尺寸下的视觉表现。"
  val readerBody = """
    阅读体验并不是把网页直接嵌进手机屏幕。它需要在保存原始内容和提升移动端可读性之间找到边界。

    在 UI Lab 中，正文、摘要、任务和分享页面都使用固定夹具，因此每次截图都可复现，不受真实服务端数据、网络状态或采集进度影响。

    后续设计评审会在这里完成浅色、深色、空态、加载态、长内容和失败态的视觉验证，再进入真实资料库和小米 / 澎湃 OS 真机验收。
  """.trimIndent()

  val posterArticle = ArticleDetail(
    id = 240,
    title = "炸裂！5.5k Star anydoc 一锅端，Word、PPT、Excel、PDF",
    author = "小华",
    source = "公众号",
    coverImage = "https://images.unsplash.com/photo-1515879218367-8466d910aaa4?auto=format&fit=crop&w=1200&q=85",
    publishTime = "2026-08-07T15:59:00Z",
    aiSummary = "一个统一处理 Word、PPT、Excel 与 PDF 的开源工具，适合需要在多种文档格式间转换、提取和整理内容的工作流。这里使用更长的固定摘要验证内容不会进入底部二维码区域。",
    isPublished = true,
  )
}
