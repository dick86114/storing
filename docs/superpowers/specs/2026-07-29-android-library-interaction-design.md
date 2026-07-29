# Android library interaction refresh — design

**Date:** 2026-07-29  
**Status:** Approved design; ready for written-spec review  
**Scope:** `apps/android` and the backwards-compatible source-filter contract in `apps/api`

## Goals

Improve the Android library experience in six connected areas:

1. Render two-column mode as a masonry/staggered layout.
2. Make horizontal tab switching finger-following and remove list skeleton flashes during tab switches.
3. Notify an active user when a collection job completes and let them refresh into the inbox.
4. Make sort and source controls use the same corner radius as the presentation-mode selector.
5. Replace the inline top-bar search field with a dedicated search page that includes persistent history.
6. Replace the archive source dropdown with a searchable multi-select source filter.

## Non-goals

- Redesigning article cards or changing article actions.
- Changing server-side article ownership, visibility, sorting semantics, or cache policy beyond multi-source filtering.
- Replacing background collection notifications; they remain necessary when the app is not in the foreground.
- Introducing account-synced search history. History is local to the Android device.

## Architecture and state model

### Tab paging

- Replace manual `detectHorizontalDragGestures` plus `AnimatedContent` with a Compose `HorizontalPager` backed by the fixed `LibraryView` order.
- Keep the selected tab and pager page synchronized in both directions:
  - A top or bottom tab tap animates the pager to that page.
  - A settled pager page selects the corresponding `LibraryView` in `LibraryViewModel`.
- Retain a per-tab rendered-state cache in the UI so a previously visited tab stays visible while its fresh request resolves.
- Do not render skeleton cards for a tab transition, sorting, source filtering, search entry/exit, or refresh. Skeletons are allowed only for a cold app start before any library content can be shown.
- Preserve the existing per-tab scroll positions. Refresh retains the visible position where the current list type permits it.

### Two-column layout

- In `ArticleListPresentationMode.Grid`, use `LazyVerticalStaggeredGrid` with two fixed columns and existing card spacing.
- Items flow into the next available column rather than being grouped in pairs. This produces a masonry layout when card heights differ.
- Header/filter content, empty/error states, collection task card, and load-more status span both columns.
- Compact-list and card modes retain their existing linear list behavior.

### Source-filter contract

- Existing API callers may continue to send a single `category` query parameter.
- The API accepts repeated `category` values for multi-select, e.g. `?category=公众号A&category=网站B`.
- The API applies an OR/union condition: an archive article is returned when its source equals any selected category.
- No `category` parameter means all sources. `category=all` remains treated as all sources for compatibility.
- Android represents selections as a set/list of source values. Its label is:
  - no selection: `全部来源`;
  - one selection: that source name;
  - several selections: `N 个来源`.
- Source counts remain the user-scoped summary already returned by `/sources`.

### Search history

- Add a local Android search-history store with an injectable repository abstraction and persistent device storage.
- Store only normalized non-empty submitted search strings; deduplicate case-insensitively and cap history at a small fixed limit (20 entries).
- The dedicated search page loads, deletes, clears, and selects history entries through that repository.

### Collection-completion events

- `CollectJobsViewModel` establishes a baseline when it first receives jobs, then emits a one-shot foreground event only when an observed active job subsequently transitions to `completed`.
- Do not show completion snackbars for already-finished jobs loaded at app start or for failed jobs.
- `LibraryScreen` consumes the event once, shows a snackbar, and exposes a refresh action. Its action selects Inbox then refreshes the list.
- The existing worker-issued background notification remains; its successful wording makes it clear that the article is now available.

## UI behavior

### Sort and source controls

- Use a shared 14dp rounded-rectangle shape for sort, source, and presentation controls.
- Keep controls at the existing 40dp height and use the same outline/selected-state treatment.
- Keep sort behavior unchanged, including sorting direction and reset.

### Dedicated search page

- Tapping the library search icon pushes/opens a full-screen search surface, rather than expanding the app-bar title.
- The page contains a back action, focused query input, clear-input action, and results area.
- With no query: show recent search history; each item can run the search, and the page offers clear-all.
- With a query: debounce requests, show results in the active library context, and display normal empty/error states without skeleton flashes.
- Submitting a non-empty query writes it to local history. Returning closes the search page and restores the library's tab, filters, sorting, and scroll state.

### Source filter sheet

- Tapping the archive source control opens a modal bottom sheet, not a dropdown menu.
- The sheet contains a title, close button, searchable source list, source counts, and checkboxes.
- Selection is drafted inside the sheet and applied only by the bottom confirm button.
- `清空筛选` clears the draft; applying no selection restores all sources.
- Searching filters only the visible options and must not discard selections that are temporarily hidden.
- The confirm button remains visible at the bottom and says `查看 N 个来源的文章`; when none are selected it says `查看全部来源`.

### Completion feedback

- Foreground message: `已采集《标题》，刷新后可在收件箱查看`.
- Action: `刷新查看`.
- Action behavior: select Inbox, refresh, and dismiss the snackbar. The newly collected item becomes visible according to the active sort.

## Error handling and compatibility

- If a source list cannot load, keep the source trigger disabled/loading as today and do not discard an already-applied selection.
- If a multi-source request fails, show the existing list error/retry behavior; source selections remain intact for retry.
- Category parsing must ignore blank repeated values and preserve single-category behavior.
- The local search-history store must tolerate corrupted or unreadable persisted data by returning an empty history instead of blocking search.

## Test plan

### Android unit tests

- Source selection model: empty, one, multiple selections; labels; clearing; source-search filtering without losing draft selections.
- Retrofit/request boundary: repeated category values are sent for multiple selections and omitted for no selection.
- Search history: normalized deduplication, ordering, per-item delete, clear all, fixed limit, malformed-storage fallback.
- Collection job transitions: no event for initial completed jobs, one event for active-to-completed, no duplicate event on polling, no event for failed jobs.
- Presentation/loading rules: a tab switch with cached or pending content does not request library skeleton cards; cold start remains eligible.

### API tests

- Archive endpoint returns all selected categories through OR semantics.
- One `category` remains equivalent to current behavior.
- No category and `category=all` remain unfiltered.
- Source-filter authorization remains user-scoped.

### Build and UI verification

- Run Android unit tests and assemble the Debug APK using `apps/android/gradlew -p apps/android` with the installed Android SDK variables.
- Run relevant API tests/build and `git diff --check`.
- If an emulator/device is available, verify: masonry ordering, finger-following tab drag, no tab-switch skeleton flash, search history lifecycle, source-sheet multi-selection/clear behavior, and completion snackbar action.

## Files expected to change

- Android library UI and view model/state under `apps/android/app/src/main/java/com/idickies/storing/ui/` and `.../library/`.
- Android collection jobs/notification code under `apps/android/app/src/main/java/com/idickies/storing/collect/` and `.../notification/`.
- Android source/API model layer under `apps/android/app/src/main/java/com/idickies/storing/network/` and `.../library/`.
- Targeted Android unit tests under `apps/android/app/src/test/java/com/idickies/storing/`.
- API source-filter handling and tests under `apps/api/src/routes/` and applicable test locations.

