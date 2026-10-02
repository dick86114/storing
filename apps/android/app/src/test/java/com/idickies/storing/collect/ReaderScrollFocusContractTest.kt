package com.idickies.storing.collect

import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

class ReaderScrollFocusContractTest {
  @Test
  fun `reader webview container claims touch focus before the webview`() {
    val file = File(System.getProperty("user.dir")).resolve("src/main/java/com/idickies/storing/ui/LibraryScreen.kt")
    val screen: String = file.readText()

    // WebView 未持焦点时第一次触摸会被用于获取焦点而不是滚动；
    // 容器必须先行持有触摸焦点，详情页第一下滑动才能直接生效。
    assertTrue(screen.contains("descendantFocusability = ViewGroup.FOCUS_BEFORE_DESCENDANTS"))
    assertTrue(screen.contains("isFocusableInTouchMode = true"))
  }
}
