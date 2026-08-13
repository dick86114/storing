package com.idickies.storing.update

sealed interface ReleaseMarkdownBlock {
  data class Heading(val text: String, val level: Int) : ReleaseMarkdownBlock
  data class Bullet(val text: String) : ReleaseMarkdownBlock
  data class Paragraph(val text: String) : ReleaseMarkdownBlock
}

fun parseReleaseMarkdown(markdown: String): List<ReleaseMarkdownBlock> {
  val blocks = mutableListOf<ReleaseMarkdownBlock>()
  val paragraph = mutableListOf<String>()

  fun flushParagraph() {
    if (paragraph.isNotEmpty()) {
      blocks += ReleaseMarkdownBlock.Paragraph(paragraph.joinToString(" ").trim())
      paragraph.clear()
    }
  }

  markdown.replace("\r\n", "\n").lines().forEach { rawLine ->
    val line = rawLine.trim()
    when {
      line.isBlank() -> flushParagraph()
      line.startsWith("### ") -> { flushParagraph(); blocks += ReleaseMarkdownBlock.Heading(line.removePrefix("### ").trim(), 3) }
      line.startsWith("## ") -> { flushParagraph(); blocks += ReleaseMarkdownBlock.Heading(line.removePrefix("## ").trim(), 2) }
      line.startsWith("# ") -> { flushParagraph(); blocks += ReleaseMarkdownBlock.Heading(line.removePrefix("# ").trim(), 1) }
      line.startsWith("- ") || line.startsWith("* ") -> { flushParagraph(); blocks += ReleaseMarkdownBlock.Bullet(stripInlineMarkdown(line.drop(2).trim())) }
      else -> paragraph += stripInlineMarkdown(line)
    }
  }
  flushParagraph()
  return blocks
}

internal fun stripInlineMarkdown(value: String): String = value
  .replace(Regex("\\*\\*(.+?)\\*\\*"), "$1")
  .replace(Regex("__(.+?)__"), "$1")
  .replace(Regex("`(.+?)`"), "$1")
  .replace(Regex("\\[(.+?)]\\(.+?\\)"), "$1")
