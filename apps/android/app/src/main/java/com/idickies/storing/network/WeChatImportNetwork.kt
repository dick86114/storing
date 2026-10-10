package com.idickies.storing.network

import okhttp3.OkHttpClient
import java.util.concurrent.TimeUnit

/** 微信批量导入要等服务端解包、上图床和入库，不能复用普通接口的短超时。 */
object WeChatImportNetwork {
  fun configure(builder: OkHttpClient.Builder): OkHttpClient.Builder = builder
    .connectTimeout(30, TimeUnit.SECONDS)
    .readTimeout(10, TimeUnit.MINUTES)
    .writeTimeout(10, TimeUnit.MINUTES)
    .callTimeout(15, TimeUnit.MINUTES)

  fun failureMessage(error: Throwable): String {
    val isTimeout = error is java.net.SocketTimeoutException
      || error.message?.contains("timeout", ignoreCase = true) == true
      || error.message?.contains("timed out", ignoreCase = true) == true
    return if (isTimeout) {
      "内容较大，服务端仍在处理；请稍后在收件箱查看，不要立即重复保存"
    } else {
      error.message ?: "微信内容导入失败"
    }
  }
}
