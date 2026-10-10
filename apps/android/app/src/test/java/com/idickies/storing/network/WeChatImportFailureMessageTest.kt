package com.idickies.storing.network

import org.junit.Assert.assertEquals
import org.junit.Test
import java.net.SocketTimeoutException

class WeChatImportFailureMessageTest {
  @Test
  fun `批量导入超时显示等待提示而不是原始 timeout`() {
    val message = WeChatImportNetwork.failureMessage(SocketTimeoutException("timeout"))

    assertEquals("内容较大，服务端仍在处理；请稍后在收件箱查看，不要立即重复保存", message)
  }

  @Test
  fun `其他导入错误保留服务端原因`() {
    val message = WeChatImportNetwork.failureMessage(IllegalStateException("没有识别到聊天记录"))

    assertEquals("没有识别到聊天记录", message)
  }
}
