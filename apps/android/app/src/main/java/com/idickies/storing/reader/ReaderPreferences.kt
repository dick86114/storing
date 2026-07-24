package com.idickies.storing.reader

import android.content.Context
import androidx.lifecycle.ViewModel
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

data class ReaderPreferences(
  val textZoomPercent: Int,
  val lineHeight: Float,
  val horizontalPaddingPx: Int,
) {
  companion object {
    val Default = ReaderPreferences(
      textZoomPercent = 100,
      lineHeight = 1.8f,
      horizontalPaddingPx = 18,
    )
  }
}

@Singleton
class ReaderPreferencesStore @Inject constructor(
  @ApplicationContext context: Context,
) {
  private val preferences = context.getSharedPreferences("qiankunjie_reader", Context.MODE_PRIVATE)
  private val mutablePreferences = MutableStateFlow(read())
  val values = mutablePreferences.asStateFlow()

  fun update(next: ReaderPreferences) {
    preferences.edit()
      .putInt(TEXT_ZOOM_KEY, next.textZoomPercent)
      .putFloat(LINE_HEIGHT_KEY, next.lineHeight)
      .putInt(HORIZONTAL_PADDING_KEY, next.horizontalPaddingPx)
      .apply()
    mutablePreferences.value = next
  }

  private fun read(): ReaderPreferences = ReaderPreferences(
    textZoomPercent = preferences.getInt(TEXT_ZOOM_KEY, ReaderPreferences.Default.textZoomPercent).coerceIn(85, 135),
    lineHeight = preferences.getFloat(LINE_HEIGHT_KEY, ReaderPreferences.Default.lineHeight).coerceIn(1.4f, 2.4f),
    horizontalPaddingPx = preferences.getInt(HORIZONTAL_PADDING_KEY, ReaderPreferences.Default.horizontalPaddingPx).coerceIn(12, 36),
  )

  private companion object {
    const val TEXT_ZOOM_KEY = "text_zoom"
    const val LINE_HEIGHT_KEY = "line_height"
    const val HORIZONTAL_PADDING_KEY = "horizontal_padding"
  }
}

@HiltViewModel
class ReaderPreferencesViewModel @Inject constructor(
  private val store: ReaderPreferencesStore,
) : ViewModel() {
  val preferences = store.values

  fun updateTextZoom(percent: Int) = update { it.copy(textZoomPercent = percent) }
  fun updateLineHeight(lineHeight: Float) = update { it.copy(lineHeight = lineHeight) }
  fun updateHorizontalPadding(padding: Int) = update { it.copy(horizontalPaddingPx = padding) }

  private fun update(transform: (ReaderPreferences) -> ReaderPreferences) = store.update(transform(store.values.value))
}
