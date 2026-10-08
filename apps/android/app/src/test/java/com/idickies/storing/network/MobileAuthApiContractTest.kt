package com.idickies.storing.network

import kotlin.coroutines.Continuation
import org.junit.Assert.assertEquals
import org.junit.Test
import retrofit2.http.POST

class MobileAuthApiContractTest {
  @Test
  fun `修改密码目标是顶级认证路由`() {
    val annotation = MobileAuthApi::class.java
      .getMethod("changePassword", ChangePasswordRequest::class.java, Continuation::class.java)
      .getAnnotation(POST::class.java)

    assertEquals("change-password", annotation?.value)
  }
}
