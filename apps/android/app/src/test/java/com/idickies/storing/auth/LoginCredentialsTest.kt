package com.idickies.storing.auth

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class LoginCredentialsTest {
  @Test
  fun `only nonblank bounded credentials can be submitted`() {
    assertTrue(LoginCredentials(" admin ", "valid-password").isSubmittable)
    assertFalse(LoginCredentials("   ", "valid-password").isSubmittable)
    assertFalse(LoginCredentials("admin", "").isSubmittable)
    assertFalse(LoginCredentials("a".repeat(65), "valid-password").isSubmittable)
  }
}
