package com.idickies.storing.update

sealed class UpdateSource private constructor(
  val label: String,
  protected val prefix: String?,
) {
  data object Official : UpdateSource("官方 GitHub", null)
  data object GhProxy : UpdateSource("公共加速（gh-proxy）", "https://gh-proxy.com")

  class Custom(val rawValue: String) : UpdateSource("自定义更新源", normalize(rawValue)) {
    val isInvalid: Boolean get() = prefix == null
    fun prefixForStorage(): String = prefix.orEmpty()
    fun inputValue(): String = rawValue

    companion object {
      private fun normalize(value: String): String? {
        val trimmed = value.trim().removeSuffix("/")
        return trimmed.takeIf { it.startsWith("https://") && it.length > "https://".length }
      }
    }
  }

  fun resolve(githubApkUrl: String): String? {
    if (!githubApkUrl.startsWith("https://github.com/") || !githubApkUrl.contains("/releases/download/")) return null
    return prefix?.let { "$it/$githubApkUrl" } ?: githubApkUrl
  }
}
