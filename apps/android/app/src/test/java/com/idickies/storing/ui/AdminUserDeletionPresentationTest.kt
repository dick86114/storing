package com.idickies.storing.ui

import com.idickies.storing.admin.AdminUser
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AdminUserDeletionPresentationTest {
  @Test
  fun `管理员账号没有删除入口`() {
    assertFalse(
      canDeleteAdminUser(
        AdminUser(id = 1, username = "admin", role = "admin", status = "active"),
      ),
    )
  }

  @Test
  fun `普通用户删除确认要求完整用户名`() {
    val presentation = adminUserDeletionPresentation(
      AdminUser(id = 7, username = "reader", role = "user", status = "active"),
    )

    assertEquals("永久删除用户", presentation.title)
    assertEquals("reader", presentation.requiredConfirmation)
    assertTrue(presentation.warning.contains("不可恢复"))
  }
}
