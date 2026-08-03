package com.idickies.storing.ui

import androidx.compose.ui.unit.dp
import org.junit.Assert.assertEquals
import org.junit.Test

class LoginPresentationTest {
  @Test
  fun `login follows the compact brand card proportions from the approved reference`() {
    assertEquals(56.dp, loginPresentation.brandMarkSize)
    assertEquals(56.dp, loginPresentation.inputHeight)
    assertEquals(52.dp, loginPresentation.submitHeight)
    assertEquals(16.dp, loginPresentation.cardRadius)
  }

  @Test
  fun `login keeps the approved brand copy and administrator help text`() {
    assertEquals("Storing", loginPresentation.englishName)
    assertEquals("你的个人知识收藏空间", loginPresentation.tagline)
    assertEquals("账号由管理员创建，如需帮助请联系管理员", loginPresentation.helpText)
  }
}

class LoginImeLayoutTest {
  @Test
  fun `输入法只为可滚动登录表单预留空间，不移动底部版本号`() {
    assertEquals(true, loginImeLayoutPolicy.formConsumesImeInsets)
    assertEquals(false, loginImeLayoutPolicy.footerConsumesImeInsets)
  }
}
