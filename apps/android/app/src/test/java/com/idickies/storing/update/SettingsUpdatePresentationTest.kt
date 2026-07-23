package com.idickies.storing.update

import org.junit.Assert.assertEquals
import org.junit.Test

class SettingsUpdatePresentationTest {
  @Test
  fun `settings makes the manual update action directly visible when idle`() {
    assertEquals(
      SettingsUpdatePresentation(
        title = "手动检查更新",
        detail = "立即检查 GitHub Release 中是否有新版本",
        enabled = true,
      ),
      settingsUpdatePresentation(checking = false),
    )
  }

  @Test
  fun `settings keeps the update action visible but prevents duplicate requests while checking`() {
    assertEquals(
      SettingsUpdatePresentation(
        title = "正在检查更新…",
        detail = "正在请求最新版本信息",
        enabled = false,
      ),
      settingsUpdatePresentation(checking = true),
    )
  }
}
