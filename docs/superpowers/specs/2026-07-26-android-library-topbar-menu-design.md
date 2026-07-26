# Android Library Top Bar and More Menu Design

## Goal
Align the Android library top bar and overflow menu with the approved reference while preserving existing collection, search, task, settings, update, and about behavior.

## Scope
- Android `LibraryScreen` only.
- Do not modify the Web app, bottom navigation, collection sheet, or article-card behavior.

## Approved interaction contract
- Authenticated top-bar actions appear in this order: collect (`+`), search, more.
- Collect opens the existing manual URL collection sheet.
- Search replaces the usual title with a single-line top-bar search field. Closing it clears the active query and restores the normal title.
- Remove the list-body search field; filtering remains driven by the same `LibraryViewModel.search` API.
- More menu uses a grouped panel matching the reference:
  1. Collection tasks with active-job count.
  2. Display mode control is one icon-only row for System, Dark, and Light; the selected icon uses a highlighted container and theme color.
  3. System settings, check for updates with current app version, and About.
- Existing handlers and permission conditions remain unchanged.
