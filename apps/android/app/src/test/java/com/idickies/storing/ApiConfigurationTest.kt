package com.idickies.storing

import org.junit.Assert.assertEquals
import org.junit.Test

class ApiConfigurationTest {
  @Test
  fun `production API endpoint is fixed to the approved HTTPS origin`() {
    assertEquals(
      "https://storing.idickies.cc/api/v1/",
      ApiConfiguration.baseUrl,
    )
  }
}
