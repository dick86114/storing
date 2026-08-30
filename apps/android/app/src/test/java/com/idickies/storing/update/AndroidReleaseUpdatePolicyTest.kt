package com.idickies.storing.update

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class AndroidReleaseUpdatePolicyTest {
  private val release = AndroidRelease(
    versionCode = 8,
    versionName = "0.8.0",
    minimumSupportedVersionCode = 7,
    mandatory = false,
    releaseNotes = emptyList(),
    apkUrl = "https://storing.idickies.cc/downloads/android/qiankunjie-0.8.0.apk",
    sha256 = "a".repeat(64),
    publishedAt = "2026-07-23T00:00:00Z",
  )

  @Test
  fun `only a newer release prompts and the minimum version makes it mandatory`() {
    assertTrue(AndroidReleaseUpdatePolicy.shouldPrompt(currentVersionCode = 6, release = release))
    assertTrue(AndroidReleaseUpdatePolicy.isMandatory(currentVersionCode = 6, release = release))
    assertFalse(AndroidReleaseUpdatePolicy.shouldPrompt(currentVersionCode = 8, release = release))
  }

  @Test
  fun `a newer non mandatory release can be ignored but mandatory releases cannot`() {
    assertTrue(AndroidReleaseUpdatePolicy.canIgnore(currentVersionCode = 7, release = release))
    assertFalse(AndroidReleaseUpdatePolicy.canIgnore(currentVersionCode = 6, release = release))
    assertFalse(AndroidReleaseUpdatePolicy.canIgnore(currentVersionCode = 7, release = release.copy(mandatory = true)))
  }
}
