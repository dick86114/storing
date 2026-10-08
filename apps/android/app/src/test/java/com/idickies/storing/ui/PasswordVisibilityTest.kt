package com.idickies.storing.ui

import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.outlined.Visibility
import androidx.compose.material.icons.outlined.VisibilityOff
import org.junit.Assert.assertEquals
import org.junit.Test

class PasswordVisibilityTest {
  @Test
  fun `密码隐藏时默认使用闭眼图标`() {
    assertEquals(Icons.Outlined.VisibilityOff, passwordVisibilityIcon(showPassword = false))
  }

  @Test
  fun `密码显示后切换为睁眼图标`() {
    assertEquals(Icons.Outlined.Visibility, passwordVisibilityIcon(showPassword = true))
  }
}
