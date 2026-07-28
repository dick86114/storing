# Split Client Release Workflows Design

## Goal

Separate Android and browser-extension releases so Android retains explicit manual version inputs while browser extension releases automatically increment the patch version, commit it to `master`, package it, and create a dedicated Release in one run.

## Android workflow

`Release Android APK` accepts manual release tag, versionName, versionCode, minimum supported versionCode, mandatory flag, title, and notes. It keeps signed APK construction, a GitHub Release, and `android-latest/latest.json` publication. It does not inspect or change browser extension files.

## Browser extension workflow

`Release browser extension` runs only from `master`. It rejects prerelease package versions, increments the patch component (`0.1.1` to `0.1.2`), updates the package file in the runner, tests and packages the extension, validates the ZIP Manifest version, commits the package update directly to `master`, then creates `browser-extension-v<version>` with ZIP and SHA-256 assets. A failed test, package, push, or release creation stops the workflow with no release; a failed push leaves no remote version commit.

## Historical workflows

The previous unified release and prepare-PR workflows are moved from `.github/workflows` to `docs/history/release-workflows/` so they no longer appear as runnable Actions but remain auditable.
