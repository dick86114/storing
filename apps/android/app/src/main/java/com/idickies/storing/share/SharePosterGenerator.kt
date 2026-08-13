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
import com.idickies.storing.library.ArticleDetail
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import kotlin.math.roundToInt

/**
 * 公开文章海报。正文内容被严格限制在内容安全区，底部扫码区始终独立，
 * 因此长标题或摘要不会再覆盖二维码和扫码提示。
 */
object SharePosterGenerator {

  private const val POSTER_WIDTH_DP = 360
  private const val POSTER_HEIGHT_DP = 520

  internal data class SharePosterLayout(
    val width: Int,
    val height: Int,
    val contentLeft: Int,
    val contentRight: Int,
    val contentTop: Int,
    val contentBottom: Int,
    val coverHeight: Int,
    val qrTop: Int,
    val qrSize: Int,
    val sectionGap: Int,
    val footerHeight: Int,
  )

  internal data class PosterContentSlots(
    val coverHeight: Int,
    val coverBottom: Int,
    val summaryTop: Int,
    val summaryBottom: Int,
  )

  internal fun sharePosterLayout(density: Float): SharePosterLayout {
    fun dp(value: Int) = (value * density).roundToInt()
    val width = dp(POSTER_WIDTH_DP)
    val height = dp(POSTER_HEIGHT_DP)
    val pagePadding = dp(24)
    val qrSize = dp(74)
    val footerHeight = dp(26)
    val sectionGap = dp(20)
    val qrTop = height - pagePadding - footerHeight - qrSize
    return SharePosterLayout(
      width = width,
      height = height,
      contentLeft = pagePadding,
      contentRight = width - pagePadding,
      contentTop = pagePadding + dp(50),
      contentBottom = qrTop - sectionGap,
      coverHeight = dp(118),
      qrTop = qrTop,
      qrSize = qrSize,
      sectionGap = sectionGap,
      footerHeight = footerHeight,
    )
  }

  /** 在内容安全区内先为摘要预留位置，再分配封面高度。 */
  internal fun posterContentSlots(
    availableHeight: Int,
    preferredCoverHeight: Int,
    summaryHeight: Int,
    sectionGap: Int,
    coverBottomGap: Int,
  ): PosterContentSlots {
    val coverHeight = minOf(
      preferredCoverHeight,
      (availableHeight - summaryHeight - sectionGap - coverBottomGap).coerceAtLeast(0),
    )
    val summaryTop = coverHeight + if (summaryHeight > 0) coverBottomGap else 0
    return PosterContentSlots(
      coverHeight = coverHeight,
      coverBottom = coverHeight,
      summaryTop = summaryTop,
      summaryBottom = summaryTop + summaryHeight,
    )
  }

  suspend fun generate(
    context: Context,
    article: ArticleDetail,
    publicUrl: String,
    isDark: Boolean = false,
  ): Bitmap = withContext(Dispatchers.Default) {
    val density = context.resources.displayMetrics.density
    val layout = sharePosterLayout(density)
    val bitmap = Bitmap.createBitmap(layout.width, layout.height, Bitmap.Config.ARGB_8888)
    val canvas = Canvas(bitmap)

    val bgColor = if (isDark) 0xFF162820.toInt() else 0xFFF3F5F1.toInt()
    val textPrimary = if (isDark) 0xFFF1F5F0.toInt() else 0xFF162820.toInt()
    val textSecondary = if (isDark) 0xFFB6C2B8.toInt() else 0xFF65746B.toInt()
    val accentColor = if (isDark) 0xFF8DB69B.toInt() else 0xFF2F6A4F.toInt()
    val dividerColor = if (isDark) 0xFF385548.toInt() else 0xFFD9E1DA.toInt()
    val coverFallback = if (isDark) 0xFF203D2F.toInt() else 0xFF1E4432.toInt()

    canvas.drawColor(bgColor)

    val contentLeft = layout.contentLeft.toFloat()
    val contentRight = layout.contentRight.toFloat()
    val contentWidth = layout.contentRight - layout.contentLeft
    var cursorY = layout.contentTop

    drawBrandHeader(canvas, layout, density, accentColor, textSecondary, dividerColor)

    val metadata = listOfNotNull(article.category?.name, article.source, article.publishTime?.take(10))
      .filter { it.isNotBlank() }
      .joinToString(" · ")
    if (metadata.isNotBlank()) {
      val metadataPaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
        color = accentColor
        textSize = 10 * density
        typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
      }
      canvas.drawText(metadata, contentLeft, cursorY + 10 * density, metadataPaint)
      cursorY += (20 * density).roundToInt()
    }

    val titlePaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
      color = textPrimary
      textSize = 23 * density
      typeface = Typeface.create("sans-serif", Typeface.BOLD)
    }
    val titleLayout = createStaticLayout(article.displayTitle, titlePaint, contentWidth, maxLines = 2)
    canvas.withTranslation(contentLeft, cursorY.toFloat()) { titleLayout.draw(canvas) }
    cursorY += titleLayout.height + (12 * density).roundToInt()

    val sourceText = buildString {
      append(article.source.orEmpty())
      if (!article.author.isNullOrBlank()) append(" · ${article.author}")
    }
    if (sourceText.isNotBlank()) {
      val sourcePaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
        color = textSecondary
        textSize = 11 * density
      }
      canvas.drawText(sourceText, contentLeft, cursorY + 11 * density, sourcePaint)
      cursorY += (22 * density).roundToInt()
    }

    val summaryPaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
      color = textSecondary
      textSize = 12 * density
    }
    val summaryLayout = article.aiSummary?.takeIf { it.isNotBlank() }?.let { summary ->
      createStaticLayout(
        text = summary.take(72) + if (summary.length > 72) "…" else "",
        paint = summaryPaint,
        width = contentWidth - (10 * density).roundToInt(),
        maxLines = 2,
      )
    }
    val contentSlots = posterContentSlots(
      availableHeight = layout.contentBottom - cursorY,
      preferredCoverHeight = layout.coverHeight,
      summaryHeight = summaryLayout?.height ?: 0,
      sectionGap = layout.sectionGap,
      coverBottomGap = (18 * density).roundToInt(),
    )
    if (contentSlots.coverHeight > (56 * density).roundToInt()) {
      val coverRect = RectF(contentLeft, cursorY.toFloat(), contentRight, (cursorY + contentSlots.coverHeight).toFloat())
      canvas.drawRoundRect(coverRect, 8 * density, 8 * density, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = coverFallback })
      article.coverImage?.let { coverUrl ->
        loadBitmap(coverUrl)?.let { coverBitmap ->
          val srcRect = calculateCenterCropSrc(coverBitmap.width, coverBitmap.height, coverRect.width(), coverRect.height())
          canvas.drawBitmap(coverBitmap, srcRect, coverRect, Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG))
        }
      }
      cursorY += contentSlots.coverHeight
    }

    summaryLayout?.let {
      val summaryTop = cursorY + (contentSlots.summaryTop - contentSlots.coverBottom)
      val summaryAccent = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = accentColor; strokeWidth = 2 * density }
      canvas.drawLine(contentLeft, summaryTop.toFloat(), contentLeft, (summaryTop + it.height).toFloat(), summaryAccent)
      canvas.withTranslation(contentLeft + 10 * density, summaryTop.toFloat()) { it.draw(canvas) }
    }

    drawQrSection(canvas, layout, density, publicUrl, textPrimary, textSecondary, accentColor, dividerColor)
    val footerPaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply { color = textSecondary; textSize = 8 * density }
    canvas.drawText("乾坤戒 · 把值得的内容留在手边", contentLeft, layout.height - 8 * density, footerPaint)

    bitmap
  }

  private fun drawBrandHeader(
    canvas: Canvas,
    layout: SharePosterLayout,
    density: Float,
    accentColor: Int,
    textSecondary: Int,
    dividerColor: Int,
  ) {
    val left = layout.contentLeft.toFloat()
    val right = layout.contentRight.toFloat()
    val brandY = 26 * density
    val dotPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
      color = accentColor
      style = Paint.Style.STROKE
      strokeWidth = 2 * density
    }
    canvas.drawCircle(left + 6 * density, brandY, 5 * density, dotPaint)
    val brandPaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
      color = accentColor
      textSize = 13 * density
      typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
    }
    canvas.drawText("乾坤戒", left + 17 * density, brandY + 5 * density, brandPaint)
    val subPaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply { color = textSecondary; textSize = 11 * density }
    canvas.drawText("稍后阅读与收藏", left + 70 * density, brandY + 5 * density, subPaint)
    val publicPaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
      color = textSecondary
      textSize = 11 * density
      typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
    }
    val publicText = "公开文章"
    canvas.drawText(publicText, right - publicPaint.measureText(publicText), brandY + 5 * density, publicPaint)
    canvas.drawLine(left, 40 * density, right, 40 * density, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = dividerColor; strokeWidth = density })
  }

  private fun drawQrSection(
    canvas: Canvas,
    layout: SharePosterLayout,
    density: Float,
    publicUrl: String,
    textPrimary: Int,
    textSecondary: Int,
    accentColor: Int,
    dividerColor: Int,
  ) {
    val qrTop = layout.qrTop
    val qrLeft = layout.contentLeft
    val qrSize = layout.qrSize
    canvas.drawLine(
      layout.contentLeft.toFloat(),
      (qrTop - layout.sectionGap).toFloat(),
      layout.contentRight.toFloat(),
      (qrTop - layout.sectionGap).toFloat(),
      Paint(Paint.ANTI_ALIAS_FLAG).apply { color = dividerColor; strokeWidth = density },
    )
    val qrRect = RectF(qrLeft.toFloat(), qrTop.toFloat(), (qrLeft + qrSize).toFloat(), (qrTop + qrSize).toFloat())
    canvas.drawRoundRect(qrRect, 2 * density, 2 * density, Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFFFFFFFF.toInt() })
    canvas.drawBitmap(QRCodeGenerator.generate(publicUrl, qrSize), qrLeft.toFloat(), qrTop.toFloat(), Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG))

    val textLeft = qrLeft + qrSize + (16 * density).roundToInt()
    val titlePaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply {
      color = textPrimary
      textSize = 15 * density
      typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
    }
    canvas.drawText("扫码阅读全文", textLeft.toFloat(), qrTop + 24 * density, titlePaint)
    val hintPaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply { color = textSecondary; textSize = 10 * density }
    canvas.drawText("在乾坤戒中继续阅读、收藏与整理", textLeft.toFloat(), qrTop + 44 * density, hintPaint)
    val urlPaint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply { color = accentColor; textSize = 9 * density }
    val shortUrl = publicUrl.removePrefix("https://").removePrefix("http://").take(34)
    canvas.drawText(shortUrl, textLeft.toFloat(), qrTop + 61 * density, urlPaint)
  }

  private fun calculateCenterCropSrc(srcWidth: Int, srcHeight: Int, dstWidth: Float, dstHeight: Float): Rect {
    val srcRatio = srcWidth.toFloat() / srcHeight
    val dstRatio = dstWidth / dstHeight
    return if (srcRatio > dstRatio) {
      val newWidth = (srcHeight * dstRatio).toInt()
      val left = (srcWidth - newWidth) / 2
      Rect(left, 0, left + newWidth, srcHeight)
    } else {
      val newHeight = (srcWidth / dstRatio).toInt()
      val top = (srcHeight - newHeight) / 2
      Rect(0, top, srcWidth, top + newHeight)
    }
  }

  private suspend fun loadBitmap(url: String): Bitmap? = withContext(Dispatchers.IO) {
    try {
      val request = Request.Builder().url(url).build()
      OkHttpClient().newCall(request).execute().use { response ->
        if (!response.isSuccessful) return@use null
        response.body?.byteStream()?.use(BitmapFactory::decodeStream)
      }
    } catch (_: Exception) {
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
        .setLineSpacing(0f, 1.35f)
        .setBreakStrategy(LineBreaker.BREAK_STRATEGY_SIMPLE)
        .build()
    } else {
      StaticLayout(text, paint, width, Layout.Alignment.ALIGN_NORMAL, 1.35f, 0f, true)
    }
  }
}
