package com.idickies.storing.admin

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AdminUserDeletionStateTest {
  @Test
  fun `删除成功后立即从用户列表移除并公布成功提示`() {
    val state = AdminUiState(users = listOf(user(7, "reader")), submitting = true)

    val next = adminUserDeletionSucceeded(
      state,
      AdminDeleteUserResponse(
        deleted = true,
        userId = 7,
        username = "reader",
        cleanup = AdminUserCleanupSummary(),
      ),
    )

    assertTrue(next.users.none { it.id == 7 })
    assertEquals("已永久删除用户「reader」", next.notice)
    assertFalse(next.submitting)
  }

  @Test
  fun `删除失败后保留用户列表并恢复提交状态`() {
    val state = AdminUiState(users = listOf(user(7, "reader")), submitting = true)

    val next = adminUserDeletionFailed(state, IllegalStateException("HTTP 409"))

    assertEquals(listOf(user(7, "reader")), next.users)
    assertEquals("HTTP 409", next.error)
    assertFalse(next.submitting)
  }

  private fun user(id: Int, username: String) = AdminUser(
    id = id,
    username = username,
    role = "user",
    status = "active",
  )
}
