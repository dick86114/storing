package com.idickies.storing.auth

import com.idickies.storing.network.MobileUser

sealed interface MobileAuthResult {
  data class Available(val user: MobileUser) : MobileAuthResult
  data object Offline : MobileAuthResult
  data object AuthenticationRequired : MobileAuthResult
  data object Forbidden : MobileAuthResult
}
