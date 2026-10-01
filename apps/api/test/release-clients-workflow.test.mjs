import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../../../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

test('browser-extension releases use the package version as the manifest version', () => {
  const packageJson = JSON.parse(read('apps/browser-extension/package.json'));
  const manifest = read('apps/browser-extension/manifest.config.ts');

  assert.match(packageJson.version, /^\d+\.\d+\.\d+$/);
  assert.match(manifest, /import packageJson from '\.\/package\.json';/);
  assert.match(manifest, /version: packageJson\.version/);
});

test('browser extension release workflow builds and publishes a packaged artifact', () => {
  const workflow = read('.github/workflows/release-browser-extension.yml');

  assert.match(workflow, /name: Release browser extension/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, /pnpm --filter browser-extension test/);
  assert.match(workflow, /pnpm --filter browser-extension lint/);
  assert.match(workflow, /pnpm --filter browser-extension package/);
  assert.match(workflow, /gh release create/);
  assert.match(workflow, /browser-extension-v\$\{VERSION\}/);

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
