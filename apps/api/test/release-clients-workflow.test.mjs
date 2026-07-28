import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

test('browser-extension patch releases use a matching manifest and package version', () => {
  const packageJson = JSON.parse(read('apps/browser-extension/package.json'));
  const manifest = read('apps/browser-extension/manifest.config.ts');

  assert.equal(packageJson.version, '0.1.1');
  assert.match(manifest, /import packageJson from '\.\/package\.json';/);
  assert.match(manifest, /version: packageJson\.version/);
});

test('client release workflow builds Android and browser extension artifacts into one release', () => {
  const workflow = read('.github/workflows/release-clients.yml');

  assert.match(workflow, /name: Release mobile app and browser extension/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /build_android:/);
  assert.match(workflow, /build_browser_extension:/);
  assert.match(workflow, /QIANKUNJIE_VERSION_NAME/);
  assert.match(workflow, /apps\/browser-extension\/package\.json/);
  assert.match(workflow, /actions\/upload-artifact@v5/);
  assert.match(workflow, /actions\/download-artifact@v5/);
  assert.match(workflow, /gh release create/);
  assert.match(workflow, /android-latest/);
  assert.match(workflow, /always\(\) && inputs\.publish_release/);

  const ci = read('.github/workflows/ci.yml');
  assert.match(ci, /pnpm --filter browser-extension lint/);
  assert.match(ci, /pnpm --filter browser-extension test/);
});

test('browser-extension package synchronization removes stale ZIP entries', () => {
  const packageScript = read('apps/browser-extension/scripts/package.mjs');
  const packageJson = JSON.parse(read('apps/browser-extension/package.json'));

  assert.match(packageScript, /'-FS'/);
  assert.match(packageJson.scripts.package, /verify-package\.mjs/);
});
