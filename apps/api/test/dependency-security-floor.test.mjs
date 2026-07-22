import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workspaceRoot = new URL('../../../', import.meta.url);
const readJson = (path) => JSON.parse(readFileSync(new URL(path, workspaceRoot), 'utf8'));

test('direct runtime dependencies meet the patched security floors', () => {
  const api = readJson('apps/api/package.json');
  const web = readJson('apps/web/package.json');
  const mcp = readJson('apps/mcp/package.json');

  assert.equal(api.dependencies['drizzle-orm'], '^0.45.2');
  assert.equal(api.dependencies.hono, '^4.12.31');
  assert.equal(api.dependencies['@hono/node-server'], '^2.0.11');
  assert.equal(web.dependencies.next, '^15.5.18');
  assert.equal(mcp.dependencies.hono, '^4.12.31');
  assert.equal(mcp.dependencies['@hono/node-server'], '^2.0.11');
});

test('transitive runtime fixes are pinned through pnpm overrides', () => {
  const root = readJson('package.json');
  assert.equal(root.pnpm?.overrides?.['fast-uri'], '3.1.4');
  assert.equal(root.pnpm?.overrides?.undici, '7.28.0');
  assert.equal(root.pnpm?.overrides?.sharp, '0.35.3');
  assert.equal(root.pnpm?.overrides?.['@hono/node-server'], '2.0.11');
  assert.equal(root.pnpm?.overrides?.postcss, '8.5.10');
  assert.equal(root.pnpm?.overrides?.['brace-expansion'], '1.1.16');
  assert.equal(root.pnpm?.overrides?.['js-yaml'], '4.3.0');
  assert.equal(root.pnpm?.overrides?.esbuild, '0.28.1');
  assert.equal(root.devDependencies.turbo, '^2.10.5');
});
