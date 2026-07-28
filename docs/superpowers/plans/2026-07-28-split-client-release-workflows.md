# Split Client Release Workflows Implementation Plan

**Goal:** Replace the unified client release and preparation-PR workflows with independent Android manual release and browser extension auto-patch release workflows.

1. Replace the release helper and tests with tag validation, stable patch-version increment, package update, and package-version assertion coverage.
2. Archive the runnable unified workflows and add `release-android.yml` with manual Android validation and existing APK/latest-channel publishing behavior.
3. Add `release-browser-extension.yml` to bump, test, package, verify, commit, push, and publish the plugin in one job from `master`.
4. Update the operator runbook and validate workflow YAML, helper tests, extension tests, type checking, and archive paths.
