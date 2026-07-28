# Client Release Version Automation Design

**Date:** 2026-07-28  
**Status:** Approved design; implementation pending

## Goal

Make a single GitHub Release tag (`vX.Y.Z`) the canonical version for the browser extension and Android client release process while preserving a reviewable, merge-first source-history workflow.

## Current baseline

The current stable Android update manifest is published as the `latest.json` asset of the `android-latest` GitHub Release. At design time it reports:

- versionName: `2.0.3`
- versionCode: `203`
- minimumSupportedVersionCode: `203`

The browser extension package version is currently maintained in `apps/browser-extension/package.json` and is used to name the packaged ZIP.

## Release lifecycle

1. An operator dispatches **Prepare client release version** on `master` with `release_tag` such as `v2.1.0`.
2. The workflow validates the tag, derives `2.1.0`, and creates or reuses a version-bump PR that changes the browser extension package version to `2.1.0`.
3. A human reviews and merges that PR into `master`.
4. The operator dispatches **Release mobile app and browser extension** from the merged `master` revision.
5. The release workflow verifies the extension source version matches the tag, derives Android versionName from the tag, resolves Android versionCode values, builds selected clients, and creates the GitHub Release.

The prepare workflow never writes directly to `master` and never creates a GitHub Release.

## Prepare workflow requirements

- File: `.github/workflows/prepare-client-release.yml`.
- Manual input: required `release_tag` only.
- Runs only against `master`; rejects other selected branches.
- Accepts `vMAJOR.MINOR.PATCH` with an optional prerelease suffix.
- Derives `release_version` by removing the leading `v`.
- Rejects a release tag that already exists as a GitHub Release or Git tag.
- Changes only `apps/browser-extension/package.json` version.
- Uses a deterministic branch name: `release/browser-extension-v{release_version}`.
- Creates a PR targeting `master`, or reports the existing matching PR/branch without duplicating commits.
- Emits a job summary containing the requested tag, derived extension version, PR URL/state, and follow-up release command.

## Release workflow requirements

### Canonical version checks

- `release_tag` is required and must be a valid `vMAJOR.MINOR.PATCH` version.
- When browser extension packaging is selected, `apps/browser-extension/package.json.version` must exactly equal the tag without its leading `v`.
- The build must verify that the produced ZIP contains an extension manifest with the same version.
- A mismatch fails before release creation with an instruction to merge the matching prepare-release PR.

### Android value resolution

- `android_version_name` is removed as a manually supplied value. It is always the Release Tag without its leading `v`.
- `android_version_code` and `minimum_supported_version_code` remain conditionally applicable when Android is selected.
- GitHub Actions cannot dynamically prepopulate dispatch-form defaults from previous releases. Therefore blank Android numeric inputs resolve at run time from the prior stable manifest:
  - suggested versionCode = previous versionCode + 1;
  - suggested minimumSupportedVersionCode = previous minimumSupportedVersionCode.
- The validation summary must display previous, suggested, manually supplied, and resolved values.
- A manually supplied versionCode must be a positive integer and strictly greater than the prior stable versionCode.
- A manually supplied minimum supported code must be a positive integer, cannot be below the previous minimum supported code, and cannot exceed the resolved versionCode.
- If no prior stable manifest exists, numeric Android values are required and the summary explains why no automatic defaults are available.

### Form wording

GitHub Actions does not support a native required marker that is conditional on another boolean input. Android descriptions therefore use `*` as a business-level marker and explicitly state: “when Android is selected; leave blank to use the displayed automatic value.” The runtime validator remains authoritative.

## Stable-manifest lookup

The release workflow fetches the `latest.json` asset from the `android-latest` GitHub Release using the authenticated GitHub CLI. It parses and validates the asset fields before accepting them as a baseline. Missing releases/assets or malformed manifests produce a clear fallback message; no stale hard-coded version is used.

## Failure behavior

Validation errors are explicit, not bare Bash assertion exits. They identify the rejected input, the prior stable values, and the smallest valid replacement. Examples:

- `release_tag "2.1.0" is invalid; use "v2.1.0".`
- `browser extension version is "0.1.1" but release "v2.1.0" requires "2.1.0"; merge the prepare-release PR first.`
- `android_version_code "203" must be greater than the prior stable value "203"; use at least "204".`
- `minimum_supported_version_code "202" cannot be lower than the prior stable minimum "203".`

## Documentation and verification

- Update `docs/Client-GitHub-Release-Automation.md` with the two-stage process, Android derivation/default rules, and recovery guidance.
- Add automated tests for the version-resolution helper and test workflow shell paths where feasible.
- Verify YAML syntax/action linting, helper tests, extension unit tests and type checking, and the relevant workflow command paths using mocked GitHub CLI responses.
