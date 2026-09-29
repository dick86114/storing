import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

test('macOS release workflow builds an unsigned arm64 DMG and publishes macos-v tags', () => {
  const repoRoot = new URL('../../../', import.meta.url);
  const workflow = readFileSync(new URL('.github/workflows/release-macos.yml', repoRoot), 'utf8');
  const script = readFileSync(new URL('apps/macos/scripts/build-dmg.sh', repoRoot), 'utf8');
  const guide = readFileSync(new URL('docs/MacOS-Client-Release.md', repoRoot), 'utf8');

  assert.match(workflow, /workflow_dispatch/);
  assert.match(workflow, /version/);
  assert.match(workflow, /release_notes/);
  assert.match(workflow, /macos-v\$\{\{ inputs\.version \}\}/);
  assert.match(workflow, /Xcode 27/);
  assert.match(workflow, /scripts\/build-dmg\.sh/);
  assert.match(workflow, /Qiankunjie\.dmg/);
  assert.match(workflow, /Qiankunjie-\$\{VERSION\}-arm64\.dmg/);
  assert.match(workflow, /Qiankunjie\.dmg\.sha256/);
  assert.match(workflow, /contents:\s+read/);
  assert.match(workflow, /contents:\s+write/);
  assert.match(workflow, /ref:\s+master/);
  assert.doesNotMatch(workflow, /Sparkle/i);
  assert.match(script, /CODE_SIGNING_ALLOWED=NO/);
  assert.match(script, /hdiutil verify/);
  assert.match(script, /lipo -archs/);
  assert.match(script, /\.sha256/);
  assert.match(guide, /Gatekeeper/);
  assert.match(guide, /macOS 27/);
  assert.match(guide, /Apple Silicon/);
  assert.match(guide, /更新失败/);
  assert.match(guide, /无证书/);
  assert.doesNotMatch(workflow, /codesign|notarytool|stapler/);
});
