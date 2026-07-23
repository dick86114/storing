import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const apiRoot = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, apiRoot), 'utf8');

test('mobile collection API has its own routes and never changes web collection source filtering', () => {
  const route = read('src/routes/collect.ts');
  const service = read('src/services/collect.service.ts');

  for (const path of [
    '/mobile/collect',
    '/mobile/collect/jobs',
    '/mobile/collect/jobs/:id',
    '/mobile/collect/jobs/:id/retry',
  ]) assert.match(route, new RegExp(path.replaceAll('/', '\\/').replace(':id', ':id')));

  assert.match(route, /z\.enum\(\['android', 'android_share'\]\)/);
  assert.match(route, /requestSource: \['android', 'android_share'\]/);
  assert.match(route, /requestSource: 'web'/);
  assert.match(service, /'android' \| 'android_share'/);
  assert.match(service, /const sources = Array\.isArray\(filter\.requestSource\)/);
  assert.match(service, /inArray\(collectJobs\.requestSource, sources\)/);
});

test('mobile collection jobs share the guarded first-party worker rather than running capture inline', () => {
  const service = read('src/services/collect.service.ts');

  assert.match(service, /inArray\(collectJobs\.requestSource, \['web', 'android', 'android_share'\]\)/);
  assert.match(service, /requestSource !== 'mcp'/);
  assert.match(service, /inArray\(collectJobs\.requestSource, \['web', 'android', 'android_share', 'mcp'\]\)/);
});
