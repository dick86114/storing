package com.idickies.storing.ui

internal enum class ExitRequestAction { ShowHint, Exit }

/** Handles the root back gesture as a short two-step exit flow instead of a dialog. */
internal object ExitConfirmationPolicy {
  const val doubleBackWindowMillis = 2_000L

  fun action(lastBackAtMillis: Long?, nowMillis: Long): ExitRequestAction =
    if (lastBackAtMillis != null && nowMillis - lastBackAtMillis in 0..doubleBackWindowMillis) {
      ExitRequestAction.Exit
    } else {
      ExitRequestAction.ShowHint
    }
}
