package com.idickies.storing.reader

import org.junit.Assert.assertEquals
import org.junit.Test

class ReaderWebViewPolicyTest {
  @Test
  fun `shared reader web view policy disables active and local access paths`() {
    assertEquals(
      ReaderWebViewPolicy(
        javaScriptEnabled = false,
        allowFileAccess = false,
        allowContentAccess = false,
        domStorageEnabled = false,
        loadWithOverviewMode = false,
        useWideViewPort = false,
      ),
      safeReaderWebViewPolicy,
    )
  }
}
