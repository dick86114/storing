# Android Library Interaction Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a masonry two-column library, finger-following tab navigation without transition skeleton flashes, completion refresh feedback, unified controls, a dedicated local-history search page, and searchable multi-source archive filtering.

**Architecture:** Keep `LibraryViewModel` responsible for the server-backed library query, sorting, paging, and source selection while composables own pager rendering and tab-state retention. Add focused pure model/policy helpers for source selection, search history, and collection completion transitions so they receive unit coverage before UI integration. Extend the existing `category` API query backwards-compatibly to accept repeat values and apply OR filtering for archive sources.

**Tech Stack:** Kotlin, Jetpack Compose Material 3/Foundation Pager/Staggered Grid, Hilt, Retrofit, WorkManager, Android SharedPreferences storage, Hono, Drizzle ORM, TypeScript, Vitest/Node contract tests.

## Global Constraints

- Preserve existing article actions, authentication handling, list cache rules, and single-source `category` clients.
- Multi-source archive filtering uses OR/union semantics and no selected sources means all sources.
- Do not show a skeleton during tab changes, sorting, source filtering, refresh, or search; cold application startup may use a skeleton.
- Search history is Android-device-local, normalized, case-insensitively deduplicated, and capped at 20 values.
- Use `ANDROID_HOME=/opt/homebrew/share/android-commandlinetools` and `ANDROID_SDK_ROOT=/opt/homebrew/share/android-commandlinetools` for Gradle commands.
- Do not stage unrelated workspace changes.

---

## Planned File Structure

| Path | Responsibility |
|---|---|
| `apps/android/app/src/main/java/com/idickies/storing/library/ArchiveSourceFilter.kt` | Multi-selection source query model, labels, draft/search helper functions. |
| `apps/android/app/src/main/java/com/idickies/storing/library/LibraryViewModel.kt` | Persist selected source set through list requests and remove switch-triggered skeleton conditions. |
| `apps/android/app/src/main/java/com/idickies/storing/network/ArticleApi.kt` | Retrofit repeated `category` query contract. |
| `apps/android/app/src/main/java/com/idickies/storing/library/ArticleRepository.kt` | Pass all selected source categories to Retrofit and preserve cache restrictions. |
| `apps/android/app/src/main/java/com/idickies/storing/library/SearchHistoryRepository.kt` | Injectable local search-history abstraction and SharedPreferences implementation. |
| `apps/android/app/src/main/java/com/idickies/storing/di/AppModule.kt` | Bind/provide the search-history implementation. |
| `apps/android/app/src/main/java/com/idickies/storing/collect/CollectJobsViewModel.kt` | Emit one foreground completion event per observed active-to-completed transition. |
| `apps/android/app/src/main/java/com/idickies/storing/collect/CollectCompletionEvent.kt` | Pure transition/deduplication policy used by the jobs view model and unit tests. |
| `apps/android/app/src/main/java/com/idickies/storing/notification/CollectNotificationHelper.kt` | Refine successful collection notification text. |
| `apps/android/app/src/main/java/com/idickies/storing/ui/LibraryScreen.kt` | Pager, staggered grid, snackbar action, and unified controls. |
| `apps/android/app/src/test/java/com/idickies/storing/library/ArchiveSourceFilterTest.kt` | Multi-source selection and query-label regression tests. |
| `apps/android/app/src/test/java/com/idickies/storing/library/SearchHistoryRepositoryTest.kt` | Local search-history behavior tests using a fake storage adapter. |
| `apps/android/app/src/test/java/com/idickies/storing/collect/CollectCompletionEventTest.kt` | Completion transition and no-duplicate behavior tests. |
| `apps/android/app/src/test/java/com/idickies/storing/ui/LibraryControlPresentationTest.kt` | Shared rounded-control and no-tab-skeleton policy tests. |
| `apps/api/src/routes/articles.ts` | Parse repeated category query values and construct an `inArray` archive-source condition. |
| `apps/api/test/article-source-filter-contract.test.mjs` | Static/source contract tests for compatibility and OR filtering. |

## Task 1: Establish multi-source filter semantics in pure Android models

**Files:**
- Modify: `apps/android/app/src/main/java/com/idickies/storing/library/ArchiveSourceFilter.kt`
- Modify: `apps/android/app/src/test/java/com/idickies/storing/library/ArchiveSourceFilterTest.kt`

**Interfaces:**
- Produces `ArchiveSourceFilter(categories: Set<String>)` with `categories`, `label`, `isAll`, and a `toggle(source)` operation.
- Produces `filteredArchiveSourceOptions(options: List<ArticleSource>, query: String): List<ArticleSource>` that filters only visible rows and never mutates selected categories.
- Consumed by `LibraryViewModel` and `LibrarySourceFilterSheet` in later tasks.

- [ ] **Step 1: Write failing model tests**

Add tests proving that:

```kotlin
val all = ArchiveSourceFilter.All
assertTrue(all.categories.isEmpty())
assertEquals("全部来源", all.label)
assertEquals("微信公众号", ArchiveSourceFilter.of("微信公众号").label)
assertEquals("2 个来源", ArchiveSourceFilter.of("微信公众号", "少数派").label)
assertEquals(setOf("少数派"), ArchiveSourceFilter.of("微信公众号").toggle("微信公众号").categories)
assertEquals(listOf("少数派"), filteredArchiveSourceOptions(options, "少数").map { it.source })
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run:

```bash
ANDROID_HOME=/opt/homebrew/share/android-commandlinetools ANDROID_SDK_ROOT=/opt/homebrew/share/android-commandlinetools apps/android/gradlew -p apps/android testDebugUnitTest --tests com.idickies.storing.library.ArchiveSourceFilterTest
```

Expected: compilation/test failure because `categories`, `of`, `toggle`, and `filteredArchiveSourceOptions` do not exist.

- [ ] **Step 3: Implement the minimal immutable filter model**

Replace the single nullable category model with an immutable normalized `Set<String>`. Keep a compatibility `category` accessor that returns the one selected value only when exactly one source is selected. Implement stable labels and pure option filtering with `contains(query, ignoreCase = true)`.

- [ ] **Step 4: Re-run the focused model test**

Run the Task 1 command. Expected: PASS.

- [ ] **Step 5: Commit the focused model change**

```bash
git add apps/android/app/src/main/java/com/idickies/storing/library/ArchiveSourceFilter.kt apps/android/app/src/test/java/com/idickies/storing/library/ArchiveSourceFilterTest.kt
git commit -m "feat(android): model multi-source archive filters"
```

## Task 2: Make Android list requests transmit all selected categories

**Files:**
- Modify: `apps/android/app/src/main/java/com/idickies/storing/network/ArticleApi.kt`
- Modify: `apps/android/app/src/main/java/com/idickies/storing/library/ArticleRepository.kt`
- Modify: `apps/android/app/src/main/java/com/idickies/storing/library/LibraryViewModel.kt`
- Modify: `apps/android/app/src/test/java/com/idickies/storing/library/ArchiveSourceFilterTest.kt`

**Interfaces:**
- Consumes `ArchiveSourceFilter.categories` from Task 1.
- Changes `ArticleApi.articles(..., category: List<String>?)` to emit repeated `category` query parameters.
- Changes `ArticleRepository.list(..., categories: Set<String> = emptySet(), ...)`.
- Produces list states whose selected categories survive request/retry and are cleared only on tab change or explicit clear/apply actions.

- [ ] **Step 1: Write failing request-state tests**

Add pure tests around an extracted `archiveSourceQueryCategories(filter)` helper proving no selections produce `null`, one selection produces one exact value, and multiple selections are stable/sorted before dispatch.

- [ ] **Step 2: Run the focused test to verify it fails**

Run the Task 1 Gradle command. Expected: compilation/test failure because the request helper does not exist.

- [ ] **Step 3: Implement Retrofit/repository/view-model propagation**

Use `@Query("category") categories: List<String>?` in Retrofit. Pass `filter.categories.takeIf { it.isNotEmpty() }` from `LibraryViewModel` through `ArticleRepository`. Keep offline-cache use restricted to an empty source set, default sort, and descending order. Rename only local parameters needed to avoid treating a set as a single category.

- [ ] **Step 4: Re-run focused Android source-filter tests**

Run the Task 1 Gradle command. Expected: PASS.

- [ ] **Step 5: Commit request propagation**

```bash
git add apps/android/app/src/main/java/com/idickies/storing/network/ArticleApi.kt apps/android/app/src/main/java/com/idickies/storing/library/ArticleRepository.kt apps/android/app/src/main/java/com/idickies/storing/library/LibraryViewModel.kt apps/android/app/src/test/java/com/idickies/storing/library/ArchiveSourceFilterTest.kt
git commit -m "feat(android): send multi-source archive filters"
```

## Task 3: Extend the API source filter without breaking existing clients

**Files:**
- Modify: `apps/api/src/routes/articles.ts`
- Create: `apps/api/test/article-source-filter-contract.test.mjs`

**Interfaces:**
- Consumes repeatable `category` parameters from Task 2 and existing one-value callers.
- Produces an archive `whereCondition` using `inArray(articles.source, categories)` for more than one valid category, `eq` for one category, and no source predicate for no values or `all`.

- [ ] **Step 1: Write failing API contract tests**

Create a Node source-contract test that asserts `articles.ts`:

```js
assert.match(source, /c\.req\.queries\('category'\)/)
assert.match(source, /inArray\(articles\.source, categoryFilters\)/)
assert.match(source, /eq\(articles\.source, categoryFilters\[0\]\)/)
assert.match(source, /categoryFilters\.length === 0/)
```

Also assert both list-query locations use the shared source-filter helper so article list and article-position calculations agree.

- [ ] **Step 2: Run the API contract test to verify it fails**

Run:

```bash
node --test apps/api/test/article-source-filter-contract.test.mjs
```

Expected: FAIL because repeated category parsing/helper calls are absent.

- [ ] **Step 3: Implement a shared category-filter helper**

Add a local helper that reads `c.req.queries('category')`, trims values, removes blanks and `all`, and deduplicates values. Add a helper that appends no predicate, `eq`, or `inArray` to the existing archive `whereCondition`. Apply it in both category-aware list/position paths.

- [ ] **Step 4: Run the API contract test and type build**

Run:

```bash
node --test apps/api/test/article-source-filter-contract.test.mjs
pnpm --filter api build
```

Expected: both commands exit 0.

- [ ] **Step 5: Commit the backwards-compatible API change**

```bash
git add apps/api/src/routes/articles.ts apps/api/test/article-source-filter-contract.test.mjs
git commit -m "feat(api): support multi-source archive filters"
```

## Task 4: Add device-local search history and its testable policy

**Files:**
- Create: `apps/android/app/src/main/java/com/idickies/storing/library/SearchHistoryRepository.kt`
- Modify: `apps/android/app/src/main/java/com/idickies/storing/di/AppModule.kt`
- Create: `apps/android/app/src/test/java/com/idickies/storing/library/SearchHistoryRepositoryTest.kt`

**Interfaces:**
- Produces `SearchHistoryRepository` with `history(): List<String>`, `record(query: String)`, `remove(query: String)`, and `clear()`.
- Produces `normalizeSearchHistory(history: List<String>, query: String, limit: Int = 20): List<String>` for deterministic test coverage.
- Consumed by the dedicated search composable in Task 7.

- [ ] **Step 1: Write failing history-policy tests**

Cover trim/blank exclusion, case-insensitive replacement, newest-first ordering, 20-item cap, single deletion, and clear behavior with the pure normalization function.

- [ ] **Step 2: Run the focused test to verify it fails**

Run:

```bash
ANDROID_HOME=/opt/homebrew/share/android-commandlinetools ANDROID_SDK_ROOT=/opt/homebrew/share/android-commandlinetools apps/android/gradlew -p apps/android testDebugUnitTest --tests com.idickies.storing.library.SearchHistoryRepositoryTest
```

Expected: compilation/test failure because the repository and normalization function do not exist.

- [ ] **Step 3: Implement the repository and Hilt binding**

Use a private Android `SharedPreferences` file and JSON/string-set-safe serialization. On malformed persisted data, return an empty list. Record only normalized queries. Bind a singleton implementation in `AppModule` without changing authentication/session storage.

- [ ] **Step 4: Re-run the focused test**

Run the Task 4 Gradle command. Expected: PASS.

- [ ] **Step 5: Commit search-history storage**

```bash
git add apps/android/app/src/main/java/com/idickies/storing/library/SearchHistoryRepository.kt apps/android/app/src/main/java/com/idickies/storing/di/AppModule.kt apps/android/app/src/test/java/com/idickies/storing/library/SearchHistoryRepositoryTest.kt
git commit -m "feat(android): persist library search history"
```

## Task 5: Detect one-shot foreground collection completion events

**Files:**
- Create: `apps/android/app/src/main/java/com/idickies/storing/collect/CollectCompletionEvent.kt`
- Modify: `apps/android/app/src/main/java/com/idickies/storing/collect/CollectJobsViewModel.kt`
- Modify: `apps/android/app/src/main/java/com/idickies/storing/notification/CollectNotificationHelper.kt`
- Create: `apps/android/app/src/test/java/com/idickies/storing/collect/CollectCompletionEventTest.kt`

**Interfaces:**
- Produces `CollectCompletionTracker.observe(jobs: List<MobileCollectJob>): List<MobileCollectJob>`.
- Produces a `SharedFlow<MobileCollectJob>` or equivalent one-shot `completionEvents` from `CollectJobsViewModel`.
- Consumed by `LibraryScreen` in Task 7.

- [ ] **Step 1: Write failing tracker tests**

Add tests asserting that the first observed completed job emits nothing, a tracked active job transitioning to completed emits once, repeated completed polling emits nothing, and failed transitions emit nothing.

- [ ] **Step 2: Run the focused test to verify it fails**

Run:

```bash
ANDROID_HOME=/opt/homebrew/share/android-commandlinetools ANDROID_SDK_ROOT=/opt/homebrew/share/android-commandlinetools apps/android/gradlew -p apps/android testDebugUnitTest --tests com.idickies.storing.collect.CollectCompletionEventTest
```

Expected: compilation/test failure because `CollectCompletionTracker` does not exist.

- [ ] **Step 3: Implement tracker and view-model event emission**

Keep a baseline map of job status on the first successful poll. Emit only `running/pending/etc. -> completed` transitions. Reset/deduplicate safely across polling and do not turn the event stream into persisted UI state. Update successful worker notification content to indicate the article is available in the inbox/openable from the notification.

- [ ] **Step 4: Re-run the focused test**

Run the Task 5 Gradle command. Expected: PASS.

- [ ] **Step 5: Commit completion feedback infrastructure**

```bash
git add apps/android/app/src/main/java/com/idickies/storing/collect/CollectCompletionEvent.kt apps/android/app/src/main/java/com/idickies/storing/collect/CollectJobsViewModel.kt apps/android/app/src/main/java/com/idickies/storing/notification/CollectNotificationHelper.kt apps/android/app/src/test/java/com/idickies/storing/collect/CollectCompletionEventTest.kt
git commit -m "feat(android): signal completed collection jobs"
```

## Task 6: Add UI policy tests before replacing library controls

**Files:**
- Modify: `apps/android/app/src/main/java/com/idickies/storing/ui/LibraryScreen.kt`
- Modify: `apps/android/app/src/test/java/com/idickies/storing/ui/LibraryControlPresentationTest.kt`

**Interfaces:**
- Produces shared `libraryControlShape` and `shouldShowLibrarySkeleton(loading, articles, isColdStart)` helpers.
- Produces the private/visible selection-label functions used by controls and source sheet.
- Consumed by Task 7 UI integration.

- [ ] **Step 1: Write failing UI policy tests**

Add tests asserting `libraryControlShape` uses 14.dp corners and that only a true cold start with no articles returns `true` from `shouldShowLibrarySkeleton`; a tab transition/loading cache state returns `false`.

- [ ] **Step 2: Run the focused test to verify it fails**

Run:

```bash
ANDROID_HOME=/opt/homebrew/share/android-commandlinetools ANDROID_SDK_ROOT=/opt/homebrew/share/android-commandlinetools apps/android/gradlew -p apps/android testDebugUnitTest --tests com.idickies.storing.ui.LibraryControlPresentationTest
```

Expected: compilation/test failure because the policy/shape definitions do not exist.

- [ ] **Step 3: Implement the shared control/loading policy**

Introduce one rounded 14.dp shape used by presentation, sort, and source controls. Implement the skeleton guard so cached/transition content does not insert `LibrarySkeletonCard` items.

- [ ] **Step 4: Re-run the focused test**

Run the Task 6 Gradle command. Expected: PASS.

- [ ] **Step 5: Commit UI policy primitives**

```bash
git add apps/android/app/src/main/java/com/idickies/storing/ui/LibraryScreen.kt apps/android/app/src/test/java/com/idickies/storing/ui/LibraryControlPresentationTest.kt
git commit -m "refactor(android): unify library control policies"
```

## Task 7: Integrate pager, masonry grid, source sheet, search page, and completion snackbar

**Files:**
- Modify: `apps/android/app/src/main/java/com/idickies/storing/ui/LibraryScreen.kt`
- Create if needed: `apps/android/app/src/main/java/com/idickies/storing/ui/LibrarySearchScreen.kt`
- Create if needed: `apps/android/app/src/main/java/com/idickies/storing/ui/LibrarySourceFilterSheet.kt`

**Interfaces:**
- Consumes Tasks 1–6.
- Produces the complete library UI behavior described in the design specification.

- [ ] **Step 1: Add/extend composable tests or policy test seams first**

Before UI edits, add testable helpers for pager page-to-`LibraryView` mapping, selection draft confirmation, and search-history display state. Tests must cover both drag/tab synchronization mapping and a `清空筛选` draft applying all sources.

- [ ] **Step 2: Run the relevant Android unit tests to verify failure**

Run:

```bash
ANDROID_HOME=/opt/homebrew/share/android-commandlinetools ANDROID_SDK_ROOT=/opt/homebrew/share/android-commandlinetools apps/android/gradlew -p apps/android testDebugUnitTest --tests com.idickies.storing.ui.LibraryControlPresentationTest --tests com.idickies.storing.library.ArchiveSourceFilterTest
```

Expected: FAIL because the new helper behavior is not implemented.

- [ ] **Step 3: Replace manual swipe/animated content with `HorizontalPager`**

Remove the `pointerInput`/`detectHorizontalDragGestures` state machine and its delayed `AnimatedContent` switch. Create `rememberPagerState` for `LibraryView.entries.size`; route tab taps to `animateScrollToPage`; observe settled page changes to call `libraryViewModel.select`. Keep per-tab `LazyListState` and rendered caches. Do not call the selection function repeatedly for the already-selected page.

- [ ] **Step 4: Replace row-chunked grid with `LazyVerticalStaggeredGrid`**

Render Grid mode using two fixed staggered columns. Ensure filter/header cards, empty/error states, sharing UI, and pagination status use full-line spans. Keep long press/open callbacks and article keys intact. Maintain compact/card layout behavior.

- [ ] **Step 5: Replace the archive source dropdown with a draftable bottom sheet**

Replace `LibrarySourceMenu` with a `ModalBottomSheet`. Initialize a draft from `state.archiveSource.categories`; search visible sources; toggle checkbox rows; keep off-search selections; clear to empty; apply once through `libraryViewModel.selectArchiveSources(draft)`. Use the shared control shape and selected-source label.

- [ ] **Step 6: Replace inline top-bar search with a dedicated screen**

Remove `topSearchOpen`/inline `OutlinedTextField` from the top app bar. Add a screen-level search state opened by the search action, with back, input, debounced `libraryViewModel.search`, result/empty state, history rows, delete/clear, and history recording on submit. On exit, clear active search and restore the existing list state rather than replacing the current tab.

- [ ] **Step 7: Consume completion events through a snackbar**

Create a `SnackbarHostState`; collect `jobsViewModel.completionEvents` only while the screen is active. Show the specified completion text and `刷新查看` action. On action result, page/select Inbox, request refresh, and avoid a skeleton insertion.

- [ ] **Step 8: Run the relevant Android unit tests to verify pass**

Run the Task 7 Step 2 command plus Task 4 and Task 5 focused tests. Expected: PASS.

- [ ] **Step 9: Commit UI integration**

```bash
git add apps/android/app/src/main/java/com/idickies/storing/ui/LibraryScreen.kt apps/android/app/src/main/java/com/idickies/storing/ui/LibrarySearchScreen.kt apps/android/app/src/main/java/com/idickies/storing/ui/LibrarySourceFilterSheet.kt apps/android/app/src/test/java/com/idickies/storing/ui/LibraryControlPresentationTest.kt apps/android/app/src/test/java/com/idickies/storing/library/ArchiveSourceFilterTest.kt
git commit -m "feat(android): refresh library navigation and filters"
```

## Task 8: Full verification and manual interaction check

**Files:**
- Verify only; fix only regressions introduced by Tasks 1–7.

- [ ] **Step 1: Run all Android unit tests**

Run:

```bash
ANDROID_HOME=/opt/homebrew/share/android-commandlinetools ANDROID_SDK_ROOT=/opt/homebrew/share/android-commandlinetools apps/android/gradlew -p apps/android testDebugUnitTest
```

Expected: exit 0.

- [ ] **Step 2: Assemble Debug APK**

Run:

```bash
ANDROID_HOME=/opt/homebrew/share/android-commandlinetools ANDROID_SDK_ROOT=/opt/homebrew/share/android-commandlinetools apps/android/gradlew -p apps/android assembleDebug
```

Expected: exit 0 and an updated `apps/android/app/build/outputs/apk/debug/乾坤戒-v0.7.0-debug.apk`.

- [ ] **Step 3: Run API source-filter contract and API build**

Run:

```bash
node --test apps/api/test/article-source-filter-contract.test.mjs
pnpm --filter api build
git diff --check
```

Expected: every command exits 0.

- [ ] **Step 4: Perform emulator/device inspection when available**

Verify the six user-facing acceptance items at the affected Android UI locations: variable-height cards form a two-column masonry flow; drag tracks the finger and shows no transition skeleton; completion snackbar refresh action enters Inbox; control corners match; search page stores/replays/clears history; source sheet searches, multi-selects, clears, and applies OR filtering.

- [ ] **Step 5: Record verification evidence**

Record the exact test/build output, APK path, manual-inspection coverage, and any remaining device-only limitation in the final implementation report. If verification exposes a regression, return to the corresponding implementation task, add its focused regression test, and repeat that task’s verification steps before reporting completion.
