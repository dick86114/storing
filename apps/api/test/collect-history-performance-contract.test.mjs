import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const apiRoot = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, apiRoot), 'utf8');

test('历史任务列表使用用户来源排序索引且不读取 result_json', () => {
  const service = read('src/services/collect.service.ts');
  const indexes = read('src/services/db-indexes.service.ts');

  assert.match(
    indexes,
    /idx_collect_jobs_user_source_created ON collect_jobs \(user_id, request_source, created_at DESC, id DESC\)/,
  );
  assert.match(service, /列表不读取 result_json/);
  assert.match(service, /orderBy\(desc\(collectJobs\.createdAt\), desc\(collectJobs\.id\)\)/);
  assert.match(service, /Promise\.all\(\[/);
});

test('历史任务列表接口不返回详情结果 JSON', () => {
  const route = read('src/routes/collect.ts');

  assert.match(route, /function serializeJob\(job: any, includeResult = true\)/);
  assert.match(route, /includeResult \? \{ result: job\.resultJson \?\? null \} : \{\}/);
  assert.match(route, /result\.jobs\.map\(\(job\) => serializeJob\(job, false\)\)/);
});
