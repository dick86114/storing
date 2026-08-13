package com.idickies.storing.update

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class UpdateSourceTest {
  private val githubApk = "https://github.com/dick86114/storing/releases/download/v0.9.0/Qiankunjie-v0.9.0-universal-release.apk"

  @Test
  fun `官方更新源保持 GitHub 地址不变`() {
    assertEquals(githubApk, UpdateSource.Official.resolve(githubApk))
  }

  @Test
  fun `公共加速源只改写 GitHub Release 下载地址`() {
    assertEquals("https://gh-proxy.com/$githubApk", UpdateSource.GhProxy.resolve(githubApk))
    assertNull(UpdateSource.GhProxy.resolve("https://example.com/update.apk"))
  }

  @Test
  fun `自定义更新源只接受 HTTPS 前缀`() {
    assertEquals("https://mirror.example.com/$githubApk", UpdateSource.Custom("https://mirror.example.com").resolve(githubApk))
    assertTrue(UpdateSource.Custom("http://mirror.example.com").isInvalid)
  }

  @Test
  fun `自定义前缀会去除末尾斜杠避免拼接双斜杠`() {
    assertEquals("https://mirror.example.com/$githubApk", UpdateSource.Custom("https://mirror.example.com/").resolve(githubApk))
  }
}
