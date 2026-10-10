package com.idickies.storing.library

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class BulkUiStateReducerTest {
  @Test
  fun `运行中的动作禁止再次执行`() {
    val current = BulkUiState(runningAction = BulkToolbarAction.Delete)

    assertEquals(current, BulkUiStateReducer.apply(current, BulkUiEvent.Start(BulkToolbarAction.Favorite)))
  }

  @Test
  fun `整体失败保留上下文`() {
    val current = BulkUiState(
      runningAction = BulkToolbarAction.Delete,
      selectedIds = setOf(1, 2),
      result = NativeBulkResult(2, 0, 0, emptyList(), emptyList()),
    )

    val next = BulkUiStateReducer.apply(current, BulkUiEvent.Failure("请求失败"))

    assertEquals(BulkToolbarAction.Delete, current.runningAction)
    assertNull(next.runningAction)
    assertEquals(setOf(1, 2), next.selectedIds)
    assertEquals("请求失败", next.error)
    assertEquals(current.result, next.result)
  }

  @Test
  fun `部分成功写入结果并保留选择集`() {
    val result = NativeBulkResult(2, 1, 0, emptyList(), emptyList())

    val next = BulkUiStateReducer.apply(
      BulkUiState(runningAction = BulkToolbarAction.Delete, selectedIds = setOf(1, 2)),
      BulkUiEvent.Success(BulkToolbarAction.Delete, result),
    )

    assertNull(next.runningAction)
    assertEquals(result, next.result)
    assertEquals(setOf(1, 2), next.selectedIds)
  }
}
