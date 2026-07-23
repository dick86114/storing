package com.idickies.storing.uilab

import org.junit.Assert.assertEquals
import org.junit.Test

class UiLabScenarioTest {
  @Test
  fun `unknown UI Lab route safely falls back to the library scenario`() {
    assertEquals(UiLabScenario.Library, UiLabScenario.fromRoute(null))
    assertEquals(UiLabScenario.Reader, UiLabScenario.fromRoute("reader"))
    assertEquals(UiLabScenario.Settings, UiLabScenario.fromRoute("settings"))
    assertEquals(UiLabScenario.Login, UiLabScenario.fromRoute("login"))
    assertEquals(UiLabScenario.Library, UiLabScenario.fromRoute("not-a-page"))
  }

  @Test
  fun `each scenario exposes a stable route for adb screenshot commands`() {
    assertEquals("library", UiLabScenario.Library.route)
    assertEquals("tasks", UiLabScenario.Tasks.route)
    assertEquals("settings", UiLabScenario.Settings.route)
    assertEquals("login", UiLabScenario.Login.route)
  }
}
