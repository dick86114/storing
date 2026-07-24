package com.idickies.storing.security

import android.content.Context
import androidx.biometric.BiometricManager as AndroidxBiometricManager

object BiometricManager {

  fun canAuthenticate(context: Context): Boolean {
    val manager = AndroidxBiometricManager.from(context)
    return manager.canAuthenticate(AndroidxBiometricManager.Authenticators.BIOMETRIC_WEAK) ==
      AndroidxBiometricManager.BIOMETRIC_SUCCESS
  }
}
