# Android Library Top Bar and More Menu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Android library's top actions, inline search location, and overflow menu with the approved navigation pattern.

**Architecture:** Keep all state in `LibraryScreen` and call existing `LibraryViewModel` search/collection handlers. Extract a small menu composable only if it prevents the main `TopAppBar` from becoming less readable; retain existing task/settings/update/about destinations. Use testable presentation helpers for search visibility/menu labels when practical.

**Tech Stack:** Kotlin, Jetpack Compose Material 3, Android Gradle unit tests.

## Global Constraints
- Android only; no Web change.
- Keep the existing manual collection sheet, task sheet, settings, update, About, and theme callbacks.
- Search starts from the header and must not leave a duplicate list-body search input.
- Preserve unrelated uncommitted user-management and article-card work.

---

### Task 1: Add top-bar search state and action order

**Files:**
- Modify: `apps/android/app/src/main/java/com/idickies/storing/ui/LibraryScreen.kt:200-212, 342-448, 960-971`
- Create: `apps/android/app/src/test/java/com/idickies/storing/ui/LibraryTopBarPresentationTest.kt`

- [ ] Write a failing test for the top-action order (`collect`, `search`, `more`) and top-search visibility contract.
- [ ] Run the focused test and confirm it fails before the helper exists.
- [ ] Add the helper/state and render a closeable top-bar search field that calls `libraryViewModel.search`.
- [ ] Remove the body-list search field and preserve search-result filtering.
- [ ] Re-run the focused test.

### Task 2: Convert the more menu to the approved grouped panel

**Files:**
- Modify: `apps/android/app/src/main/java/com/idickies/storing/ui/LibraryScreen.kt:375-440`
- Test: `apps/android/app/src/test/java/com/idickies/storing/ui/LibraryTopBarPresentationTest.kt`

- [ ] Add a testable menu-entry presentation contract for the three display modes and the current application version label.
- [ ] Render the three display modes as one icon-only row; highlight the active icon and retain labels only as accessibility descriptions.
- [ ] Keep collection tasks, settings, update, and About callbacks; display the version alongside the update entry.
- [ ] Re-run focused tests.

### Task 3: Verify Android behavior and capture a UI Lab screenshot

**Files:**
- Verify: `apps/android/app/src/main/java/com/idickies/storing/ui/LibraryScreen.kt`
- Verify: `apps/android/app/src/test/java/com/idickies/storing/ui/LibraryTopBarPresentationTest.kt`

- [ ] Run `cd apps/android && ./gradlew :app:testDebugUnitTest`.
- [ ] Run `./gradlew :app:assembleDebug` and `./gradlew :app:lintDebug`.
- [ ] Install the debug APK in the available Android emulator, exercise the top search and more-menu UI Lab/application screen as available, and save a screenshot under `artifacts/android-ui-lab/`.
- [ ] Run `git diff --check` and inspect the worktree for unrelated changes.
