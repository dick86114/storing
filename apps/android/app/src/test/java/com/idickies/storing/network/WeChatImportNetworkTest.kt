package com.idickies.storing.network

import okhttp3.OkHttpClient
import org.junit.Assert.assertEquals
import org.junit.Test
import java.util.concurrent.TimeUnit

class WeChatImportNetworkTest {
  @Test
  fun `微信导入使用专用长超时而不阻塞普通接口请求`() {
    val client = WeChatImportNetwork.configure(OkHttpClient.Builder()).build()

    assertEquals(30_000, client.connectTimeoutMillis)
    assertEquals(600_000, client.readTimeoutMillis)
    assertEquals(600_000, client.writeTimeoutMillis)
    assertEquals(900_000, client.callTimeoutMillis)
  }
}
