package com.idickies.storing.update

object GitHubTokenRules {
  private const val MAX_TOKEN_LENGTH = 512

  fun normalize(value: String?): String? {
    val token = value?.trim().orEmpty()
    return token.takeIf {
      it.isNotEmpty() && it.length <= MAX_TOKEN_LENGTH && it.none(Char::isWhitespace)
    }
  }

  fun masked(value: String): String {
    val token = normalize(value) ?: return "••••"
    return if (token.length > 8) {
      "${token.take(4)}…${token.takeLast(4)}"
    } else {
      "••••"
    }
  }
}
