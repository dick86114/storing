package com.idickies.storing.ui.components

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class ArticleSourceIconTest {
  @Test
  fun `wechat sources use the local wechat icon instead of a remote favicon`() {
    val icon = articleSourceIcon(source = "微信公众号", originalUrl = "https://mp.weixin.qq.com/s/example")

    assertEquals(ArticleSourceIconType.Wechat, icon.type)
    assertNull(icon.faviconUrl)
  }

  @Test
  fun `website sources load their own favicon and fall back in the UI when unavailable`() {
    val icon = articleSourceIcon(source = "少数派", originalUrl = "https://sspai.com/post/123")

    assertEquals(ArticleSourceIconType.Website, icon.type)
    assertEquals("https://sspai.com/favicon.ico", icon.faviconUrl)
  }

  @Test
  fun `sources without a valid website use the globe fallback`() {
    assertEquals(ArticleSourceIconType.Globe, articleSourceIcon(source = "离线文章", originalUrl = null).type)
  }
}
