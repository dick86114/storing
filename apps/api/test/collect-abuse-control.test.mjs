import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const apiRoot = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, apiRoot), 'utf8');

test('web collection queue caps active jobs per owner before inserting a new costly capture task', () => {
  const collect = read('src/services/collect.service.ts');
  assert.match(collect, /MAX_ACTIVE_WEB_COLLECT_JOBS_PER_USER/);
  assert.match(collect, /eq\(collectJobs\.userId, options\.userId\)/);
  assert.match(collect, /inArray\(collectJobs\.status, \['pending', 'running'\]\)/);
});

test('collection API does not reflect internal capture failures to callers', () => {
  const route = read('src/routes/collect.ts');
  assert.doesNotMatch(route, /message: e instanceof Error \? e\.message/);
  assert.match(route, /message: '创建采集任务失败'/);
});
