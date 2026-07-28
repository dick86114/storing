# Client Release Version Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a reviewable release-version preparation PR flow and make the unified client-release workflow derive, validate, and report browser-extension and Android versions safely.

**Architecture:** A dependency-free Node ESM helper owns all version parsing, Android-manifest parsing, extension-version checks, package-version updates, and resolution errors. GitHub Actions workflows use that helper rather than duplicating shell regexes. A new prepare workflow writes the browser extension version only on a release branch and opens a PR; the existing release workflow validates the merged source, resolves Android values from the `android-latest` release asset, and exposes resolved values as job outputs.

**Tech Stack:** GitHub Actions YAML, Bash, GitHub CLI (`gh`), Node.js 22 ESM, Node built-in `node:test`, pnpm.

## Global Constraints

- Use `release_tag` as the canonical version and accept only `vMAJOR.MINOR.PATCH` with an optional `-` or `.` prerelease suffix.
- Browser extension source, built manifest, ZIP filename, and selected release tag must all use the same semantic version after removing only the initial `v` from the tag.
- The prepare workflow creates/reuses a PR and never pushes directly to `master`.
- Keep the source change reviewable and merge-first: only a human merge of the prepare PR may update `master` before a release build.
- Android `versionName` is derived from `release_tag`; no manual `android_version_name` input remains.
- Android blank numeric inputs resolve from the `android-latest` release asset: `versionCode + 1`, with the prior minimum supported code preserved.
- GitHub Actions does not support dynamically prepopulating workflow-dispatch inputs from the previous release; blank values are instead resolved during validation and shown in the job summary.
- A manually supplied Android versionCode must be strictly greater than the prior stable versionCode; the minimum supported code cannot decrease or exceed the resolved versionCode.
- If no valid stable manifest is available, Android numeric inputs must be provided explicitly.
- Browser-only releases must not require Android inputs.
- Do not add runtime npm dependencies.
- Preserve unrelated worktree changes and keep workflow errors actionable in Chinese.

---

## File Structure

- Create `scripts/release/client-release-version.mjs`: pure version/manifest/package helpers plus small CLI commands for workflows.
- Create `scripts/release/client-release-version.test.mjs`: Node test coverage for tag, Android resolution, extension alignment, and package update behavior.
- Create `.github/workflows/prepare-client-release.yml`: manual version-preparation PR workflow.
- Modify `.github/workflows/release-clients.yml`: resolve version inputs in the validation job, require merged extension version, verify built ZIP manifest, and consume job outputs.
- Modify `docs/Client-GitHub-Release-Automation.md`: operator documentation for the two-stage process and Android default/validation rules.

## Task 1: Implement and test the release-version helper

**Files:**
- Create: `scripts/release/client-release-version.mjs`
- Create: `scripts/release/client-release-version.test.mjs`

**Interfaces:**
- Produces `parseReleaseTag(tag): { tag: string, version: string }`.
- Produces `parseStableAndroidManifest(json): { versionName: string, versionCode: number, minimumSupportedVersionCode: number }`.
- Produces `resolveAndroidRelease({ buildAndroid, releaseVersion, versionCodeInput, minimumSupportedVersionCodeInput, stableManifest }): { versionName?: string, versionCode?: number, minimumSupportedVersionCode?: number, previous?: object, suggested?: object }`.
- Produces `assertExtensionVersion({ packagePath, expectedVersion }): { version: string }`.
- Produces `setExtensionVersion({ packagePath, version }): { changed: boolean, previousVersion: string, version: string }`.
- CLI commands: `resolve`, `assert-extension-version`, and `set-extension-version`; success returns JSON to stdout and failures write a Chinese diagnostic to stderr then exit nonzero.

- [ ] **Step 1: Write failing Node tests for canonical tag and extension versions**

```js
import assert from 'node:assert/strict';
import test from 'node:test';
import { parseReleaseTag } from './client-release-version.mjs';

test('requires a v-prefixed release tag', () => {
  assert.throws(() => parseReleaseTag('2.1.0'), /v2\.1\.0/);
  assert.deepEqual(parseReleaseTag('v2.1.0-rc.1'), {
    tag: 'v2.1.0-rc.1',
    version: '2.1.0-rc.1',
  });
});
```

Add temporary-package tests verifying `assertExtensionVersion` reports both expected and actual versions, and `setExtensionVersion` changes only the JSON `version` property while preserving valid JSON formatting.

- [ ] **Step 2: Run the new test file to verify RED**

Run: `node --test scripts/release/client-release-version.test.mjs`  
Expected: FAIL because `scripts/release/client-release-version.mjs` does not exist.

- [ ] **Step 3: Add failing Android-resolution tests**

Cover these exact cases:

```js
const prior = {
  versionName: '2.0.3',
  versionCode: 203,
  minimumSupportedVersionCode: 203,
};

assert.deepEqual(
  resolveAndroidRelease({
    buildAndroid: true,
    releaseVersion: '2.1.0',
    versionCodeInput: '',
    minimumSupportedVersionCodeInput: '',
    stableManifest: prior,
  }),
  {
    versionName: '2.1.0',
    versionCode: 204,
    minimumSupportedVersionCode: 203,
    previous: prior,
    suggested: { versionCode: 204, minimumSupportedVersionCode: 203 },
  },
);
```

Also assert these cases throw Chinese diagnostics containing the stated numeric floor:

- input versionCode `203` when prior is `203` → error includes `至少应填写 "204"`;
- input minimum code `202` when prior minimum is `203` → error includes `不能小于上一最低兼容值 "203"`;
- minimum `205` when resolved versionCode is `204` → error includes `不能大于本次 versionCode "204"`;
- no prior manifest plus blank numeric input → error includes `未找到可用的上一稳定 Android 更新清单`;
- `buildAndroid: false` → no Android values are required or returned.

- [ ] **Step 4: Implement the helper and CLI with no external dependencies**

Use `node:fs`, `node:path`, and `node:process`. Implement `fail(message)` as:

```js
function fail(message) {
  throw new Error(message);
}
```

In the executable entry point, catch errors and write only `error.message` plus a newline to stderr before setting `process.exitCode = 1`.

Use this tag regex exactly:

```js
const RELEASE_TAG_PATTERN = /^v[0-9]+\.[0-9]+\.[0-9]+([.-][0-9A-Za-z.-]+)?$/;
```

Ensure all numeric parsing rejects empty strings, zero, negative values, decimal values, and non-digits. For `resolve`, read inputs from named CLI flags and output `JSON.stringify(result)` on one line so the Actions workflow can parse it reliably.

- [ ] **Step 5: Run the helper test suite to verify GREEN**

Run: `node --test scripts/release/client-release-version.test.mjs`  
Expected: all tag, extension package, stable-manifest, auto-default, manual-floor, and browser-only tests pass.

- [ ] **Step 6: Commit the helper and tests**

```bash
git add scripts/release/client-release-version.mjs scripts/release/client-release-version.test.mjs
git commit -m "feat: add client release version resolver"
```

## Task 2: Add the reviewable browser-extension version preparation workflow

**Files:**
- Create: `.github/workflows/prepare-client-release.yml`
- Uses: `scripts/release/client-release-version.mjs`

**Interfaces:**
- Consumes `workflow_dispatch.inputs.release_tag`.
- Consumes helper command `set-extension-version`.
- Produces either an existing/open PR URL or a new pull request targeting `master`.
- Requires `contents: write` and `pull-requests: write` permissions only for the prepare workflow.

- [ ] **Step 1: Add a workflow fixture-style static test assertion to the Node test file**

Read `.github/workflows/prepare-client-release.yml` from the test file after it is created and assert it contains all of:

```js
'pull-requests: write'
'base: master'
'Prepare client release version'
'client-release-version.mjs set-extension-version'
'gh pr create'
```

This prevents the workflow from silently losing its PR permission or source-of-truth update command.

- [ ] **Step 2: Run the workflow assertion test and verify RED**

Run: `node --test scripts/release/client-release-version.test.mjs`  
Expected: FAIL because the prepare workflow is absent.

- [ ] **Step 3: Create `.github/workflows/prepare-client-release.yml`**

Implement a single `prepare` job with these behaviors:

1. Require a `release_tag` form input with the description `统一 GitHub Release 标签，例如 v2.1.0`.
2. Check out `master` with `fetch-depth: 0`.
3. Reject a selected branch other than `master` using `${{ github.ref_name }}`.
4. Call helper command `resolve --build-android false` to validate the tag and capture `releaseVersion`.
5. Use `git ls-remote --tags origin "refs/tags/${RELEASE_TAG}"` and `gh release view "$RELEASE_TAG"` to reject an existing Git tag or Release.
6. Use deterministic branch name `release/browser-extension-v${RELEASE_VERSION}`.
7. Search for an open PR with `gh pr list --head "$BRANCH" --base master --state open --json url --jq '.[0].url // empty'`; if found, write its URL to `$GITHUB_STEP_SUMMARY` and exit successfully without creating another PR.
8. Invoke:

```bash
node scripts/release/client-release-version.mjs set-extension-version \
  --package-path apps/browser-extension/package.json \
  --release-tag "$RELEASE_TAG"
```

9. If the source version is already equal to `RELEASE_VERSION`, emit a summary that no version PR is needed and exit successfully.
10. Otherwise create the branch from `master`, commit only the package file as `chore(browser-extension): prepare v${RELEASE_VERSION}`, push it, and create a PR:

```bash
gh pr create \
  --base master \
  --head "$BRANCH" \
  --title "chore(browser-extension): prepare v${RELEASE_VERSION}" \
  --body "Prepare browser extension version ${RELEASE_VERSION} for GitHub Release ${RELEASE_TAG}."
```

11. Add a job summary listing tag, derived version, package old/new version, and PR URL.

- [ ] **Step 4: Run static workflow tests and YAML parsing**

Run:

```bash
node --test scripts/release/client-release-version.test.mjs
ruby -e 'require "yaml"; YAML.load_file(".github/workflows/prepare-client-release.yml"); puts "YAML OK"'
```

Expected: test suite passes and Ruby reports `YAML OK`.

- [ ] **Step 5: Commit the prepare workflow**

```bash
git add .github/workflows/prepare-client-release.yml scripts/release/client-release-version.test.mjs
git commit -m "ci: add client release preparation workflow"
```

## Task 3: Resolve and enforce versions in the client release workflow

**Files:**
- Modify: `.github/workflows/release-clients.yml`
- Modify: `scripts/release/client-release-version.test.mjs`
- Uses: `scripts/release/client-release-version.mjs`

**Interfaces:**
- `validate` job outputs: `release_version`, `android_version_name`, `android_version_code`, and `minimum_supported_version_code`.
- `build-android` consumes Android outputs via `needs.validate.outputs`.
- `build-browser-extension` consumes `release_version` via `needs.validate.outputs`.

- [ ] **Step 1: Add failing static assertions for the revised release workflow**

Assert the workflow:

- does not contain `android_version_name:` as a dispatch input;
- contains descriptions with `Android versionCode *` and `最低可继续使用 versionCode *`;
- checks out code in the `validate` job;
- downloads `latest.json` from the `android-latest` Release when Android is selected;
- calls `client-release-version.mjs resolve`;
- uses `needs.validate.outputs.android_version_code` in Android build environment;
- calls `assert-extension-version` before browser extension packaging;
- runs `unzip -p` against the ZIP manifest and compares its `version` with the resolved release version.

- [ ] **Step 2: Run the workflow assertion test and verify RED**

Run: `node --test scripts/release/client-release-version.test.mjs`  
Expected: FAIL because current workflow has the old manual Android version name/input assertions.

- [ ] **Step 3: Replace the validate job with explicit resolution and summary steps**

Modify the dispatch inputs:

```yaml
android_version_code:
  description: "Android versionCode *（仅构建 Android 时；留空自动使用上一版本 + 1）"
  required: false
  type: string
minimum_supported_version_code:
  description: "Android 最低可继续使用 versionCode *（仅构建 Android 时；留空继承上一值）"
  required: false
  type: string
```

Remove `android_version_name` from inputs entirely. Add `actions/checkout@v5` to the validate job. When Android is selected, attempt to download only the `latest.json` asset from `android-latest` using `gh release download`; pass the local path to the helper if successful, otherwise pass no manifest path. Run `resolve` once and map JSON fields to `$GITHUB_OUTPUT` with Node, not fragile shell JSON parsing.

Make the helper error fail the job after its Chinese diagnostic is written. Append a Markdown table to `$GITHUB_STEP_SUMMARY` with prior/suggested/requested/resolved Android values. For browser-only builds, state that Android resolution was skipped.

Expose the resolved values through `jobs.validate.outputs`.

- [ ] **Step 4: Update Android build and Android artifact steps to use validation outputs**

Replace all `${{ inputs.android_version_name }}`, `${{ inputs.android_version_code }}`, and `${{ inputs.minimum_supported_version_code }}` references in Android build/artifact commands with the corresponding `needs.validate.outputs` values. Preserve release notes, signing-secret checks, APK name convention, SHA-256 generation, and `latest.json` asset generation.

- [ ] **Step 5: Enforce extension source and ZIP manifest alignment**

Before extension test/package commands, run:

```bash
node scripts/release/client-release-version.mjs assert-extension-version \
  --package-path apps/browser-extension/package.json \
  --expected-version "${{ needs.validate.outputs.release_version }}"
```

After packaging, inspect `releases/browser-extension/storing-browser-extension-v${VERSION}.zip` using `unzip -p "$SOURCE" manifest.json`; parse its JSON version with Node and reject any mismatch with the resolved `release_version`. Include both expected and observed values in the error message.

- [ ] **Step 6: Run tests and YAML validation to verify GREEN**

Run:

```bash
node --test scripts/release/client-release-version.test.mjs
ruby -e 'require "yaml"; YAML.load_file(".github/workflows/release-clients.yml"); puts "YAML OK"'
pnpm --filter browser-extension test
pnpm --filter browser-extension lint
```

Expected: all helper/workflow static tests, YAML parsing, extension unit tests, and extension type checking pass.

- [ ] **Step 7: Commit the release workflow changes**

```bash
git add .github/workflows/release-clients.yml scripts/release/client-release-version.test.mjs
git commit -m "ci: resolve and validate client release versions"
```

## Task 4: Update operator documentation and complete release-flow verification

**Files:**
- Modify: `docs/Client-GitHub-Release-Automation.md`
- Modify: `scripts/release/client-release-version.test.mjs`

**Interfaces:**
- Documents the prepare workflow name, PR-only source mutation, required merge gate, Android default rules, and failure recovery messages implemented by Tasks 2–3.

- [ ] **Step 1: Add a failing documentation contract test**

In the Node test file, read the release automation document and assert it includes these literal operator-facing terms:

```js
'Prepare client release version'
'android-latest'
'上一版本 + 1'
'合并 PR'
'v2.1.0'
```

- [ ] **Step 2: Run the documentation contract test and verify RED**

Run: `node --test scripts/release/client-release-version.test.mjs`  
Expected: FAIL because the current document describes only the old single workflow.

- [ ] **Step 3: Update the runbook with exact release instructions**

Document this sequence:

1. dispatch `Prepare client release version` from `master` with `v2.1.0`;
2. review and merge the generated browser-extension version PR;
3. dispatch `Release mobile app and browser extension` from the merged `master` revision;
4. keep Android numeric inputs blank to accept the summary-derived defaults, or provide a strictly larger versionCode and a valid minimum-supported value;
5. use the validation summary to confirm the prior, suggested, and resolved Android values before a release is created.

Document that the Actions UI cannot dynamically fill values before dispatch, and that its `*` labels are conditional business markers rather than GitHub-native conditional required fields.

- [ ] **Step 4: Run final focused verification**

Run:

```bash
node --test scripts/release/client-release-version.test.mjs
ruby -e 'require "yaml"; %w[.github/workflows/prepare-client-release.yml .github/workflows/release-clients.yml].each { |file| YAML.load_file(file) }; puts "YAML OK"'
pnpm --filter browser-extension test
pnpm --filter browser-extension lint
git diff --check
git status --short --branch
```

Expected: helper/workflow/document contract tests pass, both workflows parse as YAML, extension checks pass, no whitespace errors remain, and only intended release automation files are modified.

- [ ] **Step 5: Commit documentation and verification tests**

```bash
git add docs/Client-GitHub-Release-Automation.md scripts/release/client-release-version.test.mjs
git commit -m "docs: document automated client release versions"
```
