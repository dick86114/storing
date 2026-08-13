package com.idickies.storing.update

import java.io.IOException

enum class UpdateFailureKind {
  Network,
  Server,
  Other,
}

class UpdateCheckException(
  val statusCode: Int,
  override val message: String,
  val kind: UpdateFailureKind,
) : RuntimeException(message)

fun classifyUpdateFailure(error: Throwable): UpdateFailureKind {
  var current: Throwable? = error
  while (current != null) {
    if (current is UpdateCheckException) return current.kind
    if (current is IOException) return UpdateFailureKind.Network
    current = current.cause
  }
  return UpdateFailureKind.Other
}
