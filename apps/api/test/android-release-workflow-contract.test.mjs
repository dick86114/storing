import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workspaceRoot = new URL('../../../', import.meta.url);
const read = (path) => readFileSync(new URL(path, workspaceRoot), 'utf8');

test('Android release workflow publishes a clearly labelled universal APK and stable update manifest', () => {
  const workflow = read('.github/workflows/android-release.yml');
  assert.match(workflow, /Qiankunjie-v\$\{VERSION_NAME\}-universal-release\.apk/);
  assert.match(workflow, /android-latest/);
});
