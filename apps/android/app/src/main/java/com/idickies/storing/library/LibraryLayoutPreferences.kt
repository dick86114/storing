package com.idickies.storing.library

import android.content.Context
import androidx.lifecycle.ViewModel
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

/**
 * 列表布局是用户偏好：用 rememberSaveable 只能扛住配置变更与进程重建，
 * 冷启动会回落到默认值，所以这里落盘持久化。
 */
internal fun parseArticleListPresentationMode(raw: String?): ArticleListPresentationMode =
  ArticleListPresentationMode.entries.firstOrNull { it.name == raw } ?: ArticleListPresentationMode.default

@Singleton
class LibraryLayoutPreferences @Inject constructor(
  @ApplicationContext context: Context,
) {
  private val preferences = context.getSharedPreferences(PREFERENCES_NAME, Context.MODE_PRIVATE)
  private val mutablePresentationMode =
    MutableStateFlow(parseArticleListPresentationMode(preferences.getString(KEY_PRESENTATION_MODE, null)))
  val presentationMode = mutablePresentationMode.asStateFlow()

  fun setPresentationMode(mode: ArticleListPresentationMode) {
    if (mutablePresentationMode.value == mode) return
    preferences.edit().putString(KEY_PRESENTATION_MODE, mode.name).apply()
    mutablePresentationMode.value = mode
  }

  private companion object {
    const val PREFERENCES_NAME = "qiankunjie_library_layout"
    const val KEY_PRESENTATION_MODE = "presentation_mode"
  }
}

@HiltViewModel
class LibraryLayoutViewModel @Inject constructor(
  private val preferences: LibraryLayoutPreferences,
) : ViewModel() {
  val presentationMode = preferences.presentationMode

  fun setPresentationMode(mode: ArticleListPresentationMode) = preferences.setPresentationMode(mode)
}
