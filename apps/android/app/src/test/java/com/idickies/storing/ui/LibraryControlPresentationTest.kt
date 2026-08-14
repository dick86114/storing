package com.idickies.storing.ui

import androidx.compose.ui.unit.dp
import com.idickies.storing.library.ArticleListPresentationMode
import com.idickies.storing.library.LibraryView
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.FolderOpen
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class LibraryControlPresentationTest {
  @Test
  fun `library filter triggers share one compact height`() {
    assertEquals(40.dp, libraryControlMetrics.triggerHeight)
    assertEquals(36.dp, libraryControlMetrics.presentationCellSize)
  }

  @Test
  fun `归档分类与工具栏各占一行，批量整理不再单独占行`() {
    assertEquals(2, libraryArchiveControlMetrics.maxRows)
    assertEquals(40.dp, libraryArchiveControlMetrics.toolbarHeight)
    assertTrue(libraryArchiveControlMetrics.batchActionSharesToolbar)
  }

  @Test
  fun `发布页不渲染空的资料库工具栏`() {
    assertFalse(shouldShowLibraryControls(LibraryView.Published, searchQuery = ""))
    assertTrue(shouldShowLibraryControls(LibraryView.Archive, searchQuery = ""))
  }

  @Test
  fun `文章详情将分类入口展示为归档目录而不是标签`() {
    assertEquals(Icons.Outlined.FolderOpen, detailCategoryActionIcon())
  }

  @Test
  fun `归档和手动分类共用支持快速新建的分类选择样式`() {
    assertTrue(categoryAssignmentPresentation.supportsQuickCreate)
    assertTrue(categoryAssignmentPresentation.usesCategoryColorIndicator)
  }

  @Test
  fun `拖动归档分类条时暂停外层 tab 滑动`() {
    assertFalse(isLibraryPagerUserScrollEnabled(categoryStripPressed = true))
    assertTrue(isLibraryPagerUserScrollEnabled(categoryStripPressed = false))
  }

  @Test
  fun `library menus use compact bordered widths`() {
    assertEquals(216.dp, libraryMenuMetrics.moreMenuWidth)
    assertEquals(216.dp, libraryMenuMetrics.sortMenuWidth)
    assertEquals(280.dp, libraryMenuMetrics.sourceMenuWidth)
  }

  @Test
  fun `dark detail shimmer has more contrast than light detail shimmer`() {
    assertTrue(shimmerColors(isDark = true).baseAlpha > shimmerColors(isDark = false).baseAlpha)
    assertTrue(shimmerColors(isDark = true).highlightAlpha > shimmerColors(isDark = false).highlightAlpha)
    assertTrue(shimmerColors(isDark = true).usesDarkSurfaceBase)
  }

  @Test
  fun `dual column presentation uses the staggered masonry renderer`() {
    assertTrue(usesMasonryGrid(ArticleListPresentationMode.Grid))
    assertFalse(usesMasonryGrid(ArticleListPresentationMode.Card))
  }
}
