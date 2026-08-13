package com.idickies.storing.update

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class UpdateProgressPresentationTest {
  @Test
  fun `更新过程按下载校验安装三个阶段展示`() {
    assertEquals(UpdateStage.DOWNLOADING, updateStageLabel(UpdateStage.DOWNLOADING).first)
    assertEquals("下载更新 42%", updateStageLabel(UpdateStage.DOWNLOADING, 0.42f).second)
    assertEquals("正在校验安装包…", updateStageLabel(UpdateStage.VERIFYING).second)
    assertEquals("正在打开系统安装器…", updateStageLabel(UpdateStage.INSTALLING).second)
  }

  @Test
  fun `未知文件大小时下载进度使用不确定进度`() {
    assertTrue(downloadProgressFraction(bytesRead = 10, totalBytes = -1) == null)
  }
}
