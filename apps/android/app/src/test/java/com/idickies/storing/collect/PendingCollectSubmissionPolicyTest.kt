package com.idickies.storing.collect

import java.io.IOException
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class PendingCollectSubmissionPolicyTest {
  @Test
  fun `only transport failures are saved for a later retry`() {
    assertTrue(PendingCollectSubmissionPolicy.shouldQueue(IOException("offline")))
    assertFalse(PendingCollectSubmissionPolicy.shouldQueue(IllegalArgumentException("bad URL")))
  }
}
