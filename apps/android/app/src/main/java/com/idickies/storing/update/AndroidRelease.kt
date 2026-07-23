package com.idickies.storing.update

import kotlinx.serialization.Serializable

@Serializable
data class AndroidRelease(
  val versionCode: Int,
  val versionName: String,
  val minimumSupportedVersionCode: Int,
  val mandatory: Boolean,
  val releaseNotes: List<String> = emptyList(),
  val apkUrl: String,
  val sha256: String,
  val publishedAt: String,
)

object AndroidReleaseUpdatePolicy {
  fun shouldPrompt(currentVersionCode: Int, release: AndroidRelease) = release.versionCode > currentVersionCode
  fun isMandatory(currentVersionCode: Int, release: AndroidRelease) = release.mandatory || currentVersionCode < release.minimumSupportedVersionCode
}
