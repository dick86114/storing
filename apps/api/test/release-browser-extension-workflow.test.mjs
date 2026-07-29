import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

test('browser extension release derives its patch from release tags without writing master', () => {
  const workflow = read('.github/workflows/release-browser-extension.yml');

  assert.match(workflow, /git tag -l 'browser-extension-v\*' --sort=-v:refname/);
  assert.match(workflow, /bump-patch-version --version "\$BASE_VERSION"/);
  assert.match(workflow, /set-extension-version --package-path apps\/browser-extension\/package\.json --version "\$NEXT_VERSION"/);
  assert.match(workflow, /--target "\$GITHUB_SHA"/);
  assert.doesNotMatch(workflow, /git commit/);
  assert.doesNotMatch(workflow, /git push origin HEAD:master/);
});
