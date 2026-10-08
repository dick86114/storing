import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const routeSource = readFileSync(new URL('../src/routes/ai.ts', import.meta.url), 'utf8');

test('AI 任务路由均要求登录', () => {
  assert.match(routeSource, /aiRoutes\.get\('\/ai\/jobs', requireAuth/);
  assert.match(routeSource, /aiRoutes\.post\('\/ai\/jobs\/:id\/retry', requireAuth/);
});

test('AI 任务列表返回当前用户任务与用量汇总', () => {
  const route = routeSource.slice(
    routeSource.indexOf("aiRoutes.get('/ai/jobs'"),
    routeSource.indexOf("aiRoutes.post('/ai/jobs/:id/retry'"),
  );

  assert.match(route, /getCurrentUser\(c\)\.id as number/);
  assert.match(route, /listAiGenerationJobs\(/);
  assert.match(route, /c\.json\(result\)/);
});

test('AI 任务重试只允许任务所有者触发', () => {
  const route = routeSource.slice(routeSource.indexOf("aiRoutes.post('/ai/jobs/:id/retry'"));

  assert.match(route, /getCurrentUser\(c\)\.id as number/);
  assert.match(route, /retryAiGenerationJob\(/);
  assert.match(route, /AI_JOB_NOT_FOUND/);
  assert.match(route, /AI_RETRY_FAILED/);
});
