package com.idickies.storing.auth

data class LoginCredentials(
  val username: String,
  val password: String,
) {
  val normalizedUsername: String get() = username.trim()
  val isSubmittable: Boolean get() = normalizedUsername.isNotEmpty() && normalizedUsername.length <= 64 && password.isNotEmpty() && password.length <= 256
}
