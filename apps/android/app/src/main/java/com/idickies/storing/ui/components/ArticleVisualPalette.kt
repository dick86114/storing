package com.idickies.storing.ui.components

import androidx.compose.ui.graphics.Color

data class ArticleVisualPalette(
  val start: Color,
  val end: Color,
)

object ArticleVisualPalettes {
  private val palettes = listOf(
    ArticleVisualPalette(Color(0xFFB64A3C), Color(0xFFF3B16D)),
    ArticleVisualPalette(Color(0xFF3E6674), Color(0xFF8EC0B8)),
    ArticleVisualPalette(Color(0xFF6A536E), Color(0xFFC6A6C8)),
    ArticleVisualPalette(Color(0xFF78623A), Color(0xFFE2C783)),
  )

  fun forArticle(articleId: Int): ArticleVisualPalette = palettes[Math.floorMod(articleId, palettes.size)]
}
