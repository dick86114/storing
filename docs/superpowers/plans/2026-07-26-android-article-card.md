# Android Article Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle Android's full article card to the approved cover-led reference while preserving WeChat cover ratio and existing interaction/data behavior.

**Architecture:** Keep the change localized to `QiankunjieArticleCard.kt`. Add pure, testable layout constants for the cover ratio and card geometry, apply them to the full-card renderer and its no-cover fallback, and leave `QiankunjieCompactArticleRow` untouched. Extend unit tests to lock the visual constants and fallback geometry contract.

**Tech Stack:** Kotlin, Jetpack Compose Material 3, Coil 3, Android Gradle unit tests.

## Global Constraints
- Modify Android full-card presentation only; do not change `apps/web`.
- Keep the WeChat official-account cover ratio at 2.35:1 and use centered crop for real covers.
- Retain click and long-press behavior, title/summary line limits, tag overflow behavior, and no-cover fallback.
- Preserve unrelated uncommitted Android authentication/test changes in the worktree.

---

### Task 1: Define and test the card visual contract

**Files:**
- Modify: `apps/android/app/src/main/java/com/idickies/storing/ui/components/QiankunjieArticleCard.kt:39-42`
- Create: `apps/android/app/src/test/java/com/idickies/storing/ui/components/ArticleCardLayoutTest.kt`

**Interfaces:**
- Produces `articleCardLayout` with `coverAspectRatio`, `cardCornerRadius`, `coverCornerRadius`, and `contentPadding` constants consumed by the full-card composable.

- [ ] **Step 1: Write the failing unit test** asserting `coverAspectRatio == 2.35f`, 24dp outer-card radius, 16dp cover radius, and 16dp body padding.
- [ ] **Step 2: Run the focused test** with `cd apps/android && ./gradlew :app:testDebugUnitTest --tests 'com.idickies.storing.ui.components.ArticleCardLayoutTest'`; expect unresolved visual-contract references.
- [ ] **Step 3: Add the immutable layout contract** to `QiankunjieArticleCard.kt` and use it in the full-card layout.
- [ ] **Step 4: Re-run the focused test** and confirm it passes.

### Task 2: Apply the approved full-card visual hierarchy

**Files:**
- Modify: `apps/android/app/src/main/java/com/idickies/storing/ui/components/QiankunjieArticleCard.kt:44-105`
- Test: `apps/android/app/src/test/java/com/idickies/storing/ui/components/ArticleCardLayoutTest.kt`

**Interfaces:**
- Consumes `articleCardLayout` from Task 1.
- Leaves `QiankunjieCompactArticleRow` unchanged.

- [ ] **Step 1: Update `QiankunjieArticleCard`** to apply theme-adaptive card/typography colors, approved vertical spacing, 2.35:1 cover geometry, and the existing title/summary/tag limits.
- [ ] **Step 2: Update `ArticleThumbnail`** so image and fallback cover use the same aspect ratio and top corner radius; real images use `ContentScale.Crop`.
- [ ] **Step 3: Run focused Android tests** for `ArticleCardLayoutTest` and `ArticleVisualPaletteTest`.

### Task 3: Build and verify the Android-only change

**Files:**
- Verify: `apps/android/app/src/main/java/com/idickies/storing/ui/components/QiankunjieArticleCard.kt`
- Verify: `apps/android/app/src/test/java/com/idickies/storing/ui/components/ArticleCardLayoutTest.kt`

- [ ] **Step 1: Run all Android unit tests** with `cd apps/android && ./gradlew :app:testDebugUnitTest`.
- [ ] **Step 2: Build the Debug APK** with `./gradlew :app:assembleDebug`.
- [ ] **Step 3: Run Android lint** with `./gradlew :app:lintDebug`.
- [ ] **Step 4: Run `git diff --check`** and inspect `git status --short` to confirm no unrelated changes were overwritten.
