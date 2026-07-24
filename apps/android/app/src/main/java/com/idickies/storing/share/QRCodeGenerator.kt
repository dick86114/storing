package com.idickies.storing.share

import android.graphics.Bitmap
import android.graphics.Color
import com.google.zxing.BarcodeFormat
import com.google.zxing.EncodeHintType
import com.google.zxing.qrcode.QRCodeWriter
import com.google.zxing.qrcode.decoder.ErrorCorrectionLevel

/** Generates QR code bitmaps using ZXing. */
object QRCodeGenerator {

  fun generate(
    content: String,
    sizePx: Int = 512,
    errorCorrection: ErrorCorrectionLevel = ErrorCorrectionLevel.M,
  ): Bitmap {
    val hints = mapOf(
      EncodeHintType.ERROR_CORRECTION to errorCorrection,
      EncodeHintType.MARGIN to 1,
      EncodeHintType.CHARACTER_SET to "UTF-8",
    )
    val writer = QRCodeWriter()
    val bitMatrix = writer.encode(content, BarcodeFormat.QR_CODE, sizePx, sizePx, hints)
    val width = bitMatrix.width
    val height = bitMatrix.height
    val pixels = IntArray(width * height)
    for (y in 0 until height) {
      val offset = y * width
      for (x in 0 until width) {
        pixels[offset + x] = if (bitMatrix.get(x, y)) Color.BLACK else Color.TRANSPARENT
      }
    }
    val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
    bitmap.setPixels(pixels, 0, width, 0, 0, width, height)
    return bitmap
  }
}
