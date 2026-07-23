# Android UI Lab Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Debug-only Android UI Lab and repeatable ADB screenshot workflow so UI redesign can be evaluated without production releases or real data.

**Architecture:** A `src/debug` Activity hosts fixture-only Compose scenarios selected through stable intent routes. Shell tooling builds and installs the Debug APK, launches the Activity using ADB, and writes screenshots to ignored local artifacts. Release source sets never reference the Lab Activity.

**Tech Stack:** Kotlin, Jetpack Compose, Android Debug source sets, ADB, Android Emulator, Bash.

## Global Constraints

- Only Debug builds include the UI Lab Activity and fixture data.
- UI Lab must not use Hilt repositories, network APIs, session storage, real URLs, or real article content.
- Stable routes are `library`, `reader`, `share`, and `tasks`.
- Screenshot output is local and ignored under `artifacts/android-ui-lab/`.
- Target Android 12+ with `compileSdk 36`, `targetSdk 36`, and `minSdk 31`.

---

### Task 1: Debug-only scenario contract and Activity

**Files:**
- Create: `apps/android/app/src/debug/java/com/idickies/storing/uilab/UiLabScenario.kt`
- Create: `apps/android/app/src/debug/java/com/idickies/storing/uilab/UiLabActivity.kt`
- Create: `apps/android/app/src/debug/AndroidManifest.xml`
- Test: `apps/android/app/src/test/java/com/idickies/storing/uilab/UiLabScenarioTest.kt`

- [ ] Write route fallback tests.
- [ ] Run `pnpm android:test` and verify missing scenario type fails.
- [ ] Implement the route enum and Debug-only Activity.
- [ ] Run `pnpm android:test` and `pnpm android:assembleDebug`.

### Task 2: Fixture-only Compose scenarios

**Files:**
- Create: `apps/android/app/src/debug/java/com/idickies/storing/uilab/UiLabScreen.kt`
- Create: `apps/android/app/src/debug/java/com/idickies/storing/uilab/UiLabFixtures.kt`

- [ ] Render library, reader, share and task fixture routes from the scenario enum.
- [ ] Include deterministic long-content, empty, active and failure states without repositories.
- [ ] Verify Debug compilation and confirm Release compilation does not reference UI Lab classes.

### Task 3: ADB and Emulator scripts

**Files:**
- Create: `scripts/android-ui-lab.sh`
- Create: `scripts/android-create-ui-emulator.sh`
- Modify: `.gitignore`
- Modify: `docs/Android-UI-Lab-and-Screenshot-Workflow.md`

- [ ] Implement `doctor`, `build`, `install`, `launch`, `screenshot`, and `capture` commands.
- [ ] Implement architecture-aware, opt-in Emulator/AVD creation.
- [ ] Verify scripts with `bash -n`; run `doctor` without attempting any system-image download.

### Task 4: Regression and release boundary verification

**Files:**
- Modify: `apps/android/app/build.gradle.kts` only if Debug source set wiring requires it.
- Test: `apps/android/app/src/test/java/com/idickies/storing/uilab/UiLabScenarioTest.kt`

- [ ] Run Android unit tests, lint, Debug build, and Release compilation.
- [ ] Verify Debug APK exposes `UiLabActivity` and Release APK does not.
- [ ] Capture at least one screenshot when an emulator or ADB device is available; otherwise record `doctor` output and leave no false claim of device verification.
