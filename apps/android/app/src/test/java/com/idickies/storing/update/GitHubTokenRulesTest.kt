package com.idickies.storing.update

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class GitHubTokenRulesTest {
  @Test fun 令牌会移除首尾空白并兼容不同格式() {
    assertEquals("ghp_1234567890", GitHubTokenRules.normalize("  ghp_1234567890  "))
    assertEquals("github_pat_1234567890", GitHubTokenRules.normalize(" github_pat_1234567890 "))
  }

  @Test fun 空令牌和内部空白会被拒绝() {
    assertNull(GitHubTokenRules.normalize(null))
    assertNull(GitHubTokenRules.normalize("   "))
    assertNull(GitHubTokenRules.normalize("ghp_123 456"))
  }

  @Test fun 界面只展示脱敏后的首尾字符() {
    assertEquals("ghp_…cdef", GitHubTokenRules.masked("ghp_1234567890abcdef"))
    assertEquals("••••", GitHubTokenRules.masked("short"))
  }
}
