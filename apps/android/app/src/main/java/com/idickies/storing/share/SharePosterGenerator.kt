package com.idickies.storing.share

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Paint
import android.graphics.Rect
import android.graphics.RectF
import android.graphics.Typeface
import android.graphics.text.LineBreaker
import android.os.Build
import android.text.Layout
import android.text.StaticLayout
import android.text.TextPaint
import androidx.core.graphics.withTranslation
import okhttp3.OkHttpClient
import okhttp3.Request
import com.idickies.storing.library.ArticleDetail
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlin.math.roundToInt

/**
 * Generates share poster bitmaps for published articles.
 *
 * Poster layout (1080 x 1600 dp-ish, rendered at pixel density):
 *   ┌─────────────────────────────┐
 *   │  ◉ 乾坤戒 · 稍后阅读        │  ← brand header
 *   ├─────────────────────────────┤
 *   │                             │
 *   │      [cover image]          │  ← optional cover, centered crop
 *   │                             │
 *   ├─────────────────────────────┤
 *   │  Article Title (multi-line) │
 *   │  source · author            │
 *   │  ───────────────────────    │
 *   │  AI summary (excerpt)       │
 *   │                             │
 *   │  [QR]  扫码阅读全文         │
 *   │        https://...          │
 *   └─────────────────────────────┘
 */
object SharePosterGenerator {

  private const val POSTER_WIDTH_DP = 360
  private const val POSTER_HEIGHT_DP = 520

  suspend fun generate(
    context: Context,
    article: ArticleDetail,
    publicUrl: String,
    isDark: Boolean = false,
  ): Bitmap = withContext(Dispatchers.Default) {
    val density = context.resources.displayMetrics.density
    val w = (POSTER_WIDTH_DP * density).roundToInt()
    val h = (POSTER_HEIGHT_DP * density).roundToInt()
    val bitmap = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)

    val bgColor = if (isDark) 0xFF2E3440.toInt() else 0xFFF8F6F2.toInt()
    val cardColor = if (isDark) 0xFF3B4252.toInt() else 0xFFFFFFFF.toInt()
    val textPrimary = if (isDark) 0xFFECEFF4.toInt() else 0xFF2E3440.toInt()
    val textSecondary = if (isDark) 0xFFA7AEC0.toInt() else 0xFF6B7280.toInt()
    val accentColor = if (isDark) 0xFF88C0D0.toInt() else 0xFFB48A5D.toInt()

    // Background
    canvas.drawColor(bgColor)

    // Card
    val padding = (20 * density).roundToInt()
    val cardRect = RectF(padding.toFloat(), padding.toFloat(), (w - padding).toFloat(), (h - padding).toFloat())
    val cardPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = cardColor }
    canvas.drawRoundRect(cardRect, (18 * density), (18 * density), cardPaint)

    var cursorY = padding + (20 * density)
    val contentLeft = padding + (20 * density)
    val contentRight = w - padding - (20 * density)
    val contentWidth = contentRight - contentLeft

    // Brand header
    val brandTextSize = (15 * density).roundToInt()
    val brandPaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
      color = accentColor
      textSize = brandTextSize.toFloat()
      typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
    }
    canvas.drawText("◉ 乾坤戒", contentLeft, cursorY + brandTextSize, brandPaint)
    val brandSubPaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
      color = textSecondary
      textSize = (12 * density)
    }
    canvas.drawText("稍后阅读与收藏", contentLeft + brandPaint.measureText("◉ 乾坤戒") + (8 * density), cursorY + brandTextSize, brandSubPaint)
    cursorY += (36 * density).roundToInt()

    // Cover image (if available)
    val coverHeight = (180 * density).roundToInt()
    article.coverImage?.let { coverUrl ->
      val coverBitmap = loadBitmap(context, coverUrl)
      if (coverBitmap != null) {
        val dstRect = RectF(contentLeft, cursorY, contentRight, cursorY + coverHeight.toFloat())
        // Center-crop
        val srcRect = calculateCenterCropSrc(coverBitmap.width, coverBitmap.height, dstRect.width(), dstRect.height())
        canvas.drawBitmap(coverBitmap, srcRect, dstRect, Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG))
        cursorY += coverHeight + (18 * density).roundToInt()
      }
    }

    // Title
    val titleTextSize = (22 * density).roundToInt()
    val titlePaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
      color = textPrimary
      textSize = titleTextSize.toFloat()
      typeface = Typeface.create("sans-serif", Typeface.BOLD)
    }
    val titleLayout = createStaticLayout(
      text = article.displayTitle,
      paint = titlePaint,
      width = contentWidth.toInt(),
      maxLines = 3,
    )
    canvas.withTranslation(contentLeft, cursorY.toFloat()) {
      titleLayout.draw(canvas)
    }
    cursorY += titleLayout.height + (10 * density).roundToInt()

    // Source / author
    val sourceText = buildString {
      append(article.source ?: "")
      if (!article.author.isNullOrBlank()) append(" · ${article.author}")
    }
    if (sourceText.isNotEmpty()) {
      val sourcePaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
        color = textSecondary
        textSize = (13 * density)
      }
      canvas.drawText(sourceText, contentLeft, cursorY + (14 * density), sourcePaint)
      cursorY += (26 * density).roundToInt()
    }

    // Divider
    cursorY += (8 * density).roundToInt()
    val dividerPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = if (isDark) 0xFF4C566A.toInt() else 0xFFE8E4DC.toInt()
      strokeWidth = 1 * density
    }
    canvas.drawLine(contentLeft, cursorY.toFloat(), contentLeft + (60 * density), cursorY.toFloat(), dividerPaint)
    cursorY += (14 * density).roundToInt()

    // AI Summary excerpt (if available)
    article.aiSummary?.takeIf { it.isNotBlank() }?.let { summary ->
      val summaryPaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
        color = textSecondary
        textSize = (14 * density)
      }
      val summaryLayout = createStaticLayout(
        text = summary.take(140) + if (summary.length > 140) "…" else "",
        paint = summaryPaint,
        width = contentWidth.toInt(),
        maxLines = 4,
      )
      canvas.withTranslation(contentLeft, cursorY.toFloat()) {
        summaryLayout.draw(canvas)
      }
      cursorY += summaryLayout.height + (20 * density).roundToInt()
    }

    // QR code section
    val qrSize = (92 * density).roundToInt()
    val qrLeft = contentLeft
    val qrTop = h - padding - (24 * density) - qrSize
    val qrBitmap = QRCodeGenerator.generate(publicUrl, qrSize)
    // Draw QR on a white rounded square background
    val qrBgPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFFFFFFFF.toInt() }
    val qrBgRect = RectF(qrLeft - 2, qrTop - 2, qrLeft + qrSize + 2, qrTop + qrSize + 2)
    canvas.drawRoundRect(qrBgRect, (8 * density), (8 * density), qrBgPaint)
    canvas.drawBitmap(qrBitmap, qrLeft.toFloat(), qrTop.toFloat(), Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG))

    // QR side text
    val qrTextLeft = qrLeft + qrSize + (14 * density)
    val qrTextWidth = contentRight - qrTextLeft
    val scanPaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
      color = textPrimary
      textSize = (15 * density)
      typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
    }
    canvas.drawText("扫码阅读全文", qrTextLeft, qrTop + (28 * density), scanPaint)

    val urlPaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
      color = textSecondary
      textSize = (11 * density)
    }
    val urlLayout = createStaticLayout(
      text = publicUrl,
      paint = urlPaint,
      width = qrTextWidth.toInt(),
      maxLines = 2,
    )
    canvas.withTranslation(qrTextLeft, qrTop + (40 * density)) {
      urlLayout.draw(canvas)
    }

    bitmap
  }

  private fun calculateCenterCropSrc(srcWidth: Int, srcHeight: Int, dstWidth: Float, dstHeight: Float): Rect {
    val srcRatio = srcWidth.toFloat() / srcHeight
    val dstRatio = dstWidth / dstHeight
    return if (srcRatio > dstRatio) {
      // crop horizontally
      val newWidth = (srcHeight * dstRatio).toInt()
      val left = (srcWidth - newWidth) / 2
      Rect(left, 0, left + newWidth, srcHeight)
    } else {
      // crop vertically
      val newHeight = (srcWidth / dstRatio).toInt()
      val top = (srcHeight - newHeight) / 2
      Rect(0, top, srcWidth, top + newHeight)
    }
  }

  private suspend fun loadBitmap(context: Context, url: String): Bitmap? = withContext(Dispatchers.IO) {
    try {
      val client = OkHttpClient()
      val request = Request.Builder().url(url).build()
      client.newCall(request).execute().use { response ->
        if (response.isSuccessful) {
          response.body?.byteStream()?.use { stream ->
            BitmapFactory.decodeStream(stream)
          }
        } else null
      }
    } catch (e: Exception) {
      null
    }
  }

  @Suppress("DEPRECATION")
  private fun createStaticLayout(text: String, paint: TextPaint, width: Int, maxLines: Int): StaticLayout {
    return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      StaticLayout.Builder.obtain(text, 0, text.length, paint, width)
        .setMaxLines(maxLines)
        .setEllipsize(null)
        .setAlignment(Layout.Alignment.ALIGN_NORMAL)
        .setLineSpacing(0f, 1.4f)
        .setBreakStrategy(LineBreaker.BREAK_STRATEGY_SIMPLE)
        .build()
    } else {
      StaticLayout(text, paint, width, Layout.Alignment.ALIGN_NORMAL, 1.4f, 0f, true)
    }
  }
}
