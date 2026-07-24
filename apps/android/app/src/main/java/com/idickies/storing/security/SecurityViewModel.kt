package com.idickies.storing.security

import androidx.lifecycle.ViewModel
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject

@HiltViewModel
class SecurityViewModel @Inject constructor(
  private val biometricPreferences: BiometricPreferences,
) : ViewModel() {
  val biometricEnabled = biometricPreferences.enabled

  private val mutableLocked = MutableStateFlow(false)
  val locked = mutableLocked.asStateFlow()

  fun setBiometricEnabled(enabled: Boolean) {
    biometricPreferences.setEnabled(enabled)
    if (!enabled) mutableLocked.value = false
  }

  fun onAppBackgrounded() {
    biometricPreferences.recordBackgrounded()
  }

  fun onAppResumed() {
    if (biometricPreferences.shouldLock()) {
      mutableLocked.value = true
    }
  }

  fun unlock() {
    biometricPreferences.clearBackgroundTimestamp()
    mutableLocked.value = false
  }
}
