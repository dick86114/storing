package com.idickies.storing.update

import java.io.IOException
import java.net.ConnectException
import java.net.SocketTimeoutException
import java.net.UnknownHostException
import org.junit.Assert.assertEquals
import org.junit.Test

class UpdateFailureClassificationTest {
  @Test fun 网络异常建议更换更新源() {
    assertEquals(UpdateFailureKind.Network, classifyUpdateFailure(IOException("连接失败")))
    assertEquals(UpdateFailureKind.Network, classifyUpdateFailure(SocketTimeoutException("超时")))
    assertEquals(UpdateFailureKind.Network, classifyUpdateFailure(UnknownHostException("DNS")))
    assertEquals(UpdateFailureKind.Network, classifyUpdateFailure(ConnectException("拒绝连接")))
  }

  @Test fun 服务端繁忙或限流建议更换更新源() {
    assertEquals(UpdateFailureKind.Server, classifyUpdateFailure(UpdateCheckException(408, "请求超时", UpdateFailureKind.Server)))
    assertEquals(UpdateFailureKind.Server, classifyUpdateFailure(UpdateCheckException(429, "请求过多", UpdateFailureKind.Server)))
    assertEquals(UpdateFailureKind.Server, classifyUpdateFailure(UpdateCheckException(503, "服务不可用", UpdateFailureKind.Server)))
  }

  @Test fun 普通业务错误不建议更换更新源() {
    assertEquals(UpdateFailureKind.Other, classifyUpdateFailure(UpdateCheckException(400, "请求无效", UpdateFailureKind.Other)))
    assertEquals(UpdateFailureKind.Other, classifyUpdateFailure(IllegalStateException("版本信息无效")))
  }
}
