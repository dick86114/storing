package com.idickies.storing.ui

/** Keeps accidental app exits behind an explicit second back confirmation at the root screen. */
object ExitConfirmationPolicy {
  fun requiresConfirmation(isRootScreen: Boolean): Boolean = isRootScreen
}
