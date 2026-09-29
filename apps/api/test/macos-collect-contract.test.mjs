import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const apiRoot = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, apiRoot), 'utf8');

test('macOS 采集使用隔离路由和共享受保护 worker', () => {
  const route = read('src/routes/collect.ts');
  const service = read('src/services/collect.service.ts');

  assert.match(route, /collectRoutes\.post\('\/macos\/collect'/);
  assert.match(route, /requestSource: 'macos'/);
  assert.match(route, /requestSource: \['android', 'android_share'\]/);
  assert.match(route, /requestSource: 'browser_extension'/);
  assert.match(service, /\| 'macos'/);
  assert.match(service, /\['web', 'android', 'android_share', 'browser_extension', 'macos'\]/);
  assert.match(service, /\['web', 'android', 'android_share', 'browser_extension', 'macos', 'mcp'\]/);
});
