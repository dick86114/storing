import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const routeSource = readFileSync(new URL('../src/routes/ai.ts', import.meta.url), 'utf8');
const indexSource = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8');

test('AI 设置路由均要求登录', () => {
  for (const path of [
    "aiRoutes.get('/ai/settings'",
    "aiRoutes.put('/ai/settings'",
    "aiRoutes.delete('/ai/settings'",
    "aiRoutes.post('/ai/models/discover'",
    "aiRoutes.post('/ai/settings/test'",
  ]) {
    assert.match(routeSource, new RegExp(`${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}, requireAuth`));
  }
});

test('AI 设置响应不返回明文 Key 或密文', () => {
  const getRoute = routeSource.slice(
    routeSource.indexOf("aiRoutes.get('/ai/settings'"),
    routeSource.indexOf("aiRoutes.put('/ai/settings'"),
  );
  assert.match(getRoute, /getUserAiSettingsSummary/);
  assert.match(getRoute, /c\.json\(\{ settings \}\)/);
  assert.doesNotMatch(getRoute, /apiKeyCiphertext|apiKey\.slice|apiKey\.split|decryptSecret/);
});

test('保存支持空 Key 保留，删除清空配置，测试使用极小输出', () => {
  const putRoute = routeSource.slice(
    routeSource.indexOf("aiRoutes.put('/ai/settings'"),
    routeSource.indexOf("aiRoutes.delete('/ai/settings'"),
  );
  const deleteRoute = routeSource.slice(
    routeSource.indexOf("aiRoutes.delete('/ai/settings'"),
    routeSource.indexOf("aiRoutes.post('/ai/models/discover'"),
  );
  const testRoute = routeSource.slice(routeSource.indexOf("aiRoutes.post('/ai/settings/test'"));

  assert.match(putRoute, /saveUserAiSettings/);
  assert.match(putRoute, /apiKey/);
  assert.match(deleteRoute, /deleteUserAiSettings/);
  assert.match(testRoute, /resolveUserAiRuntimeConfig/);
  assert.match(testRoute, /callUserAi\(/);
  assert.match(testRoute, /16\)/);
});

test('模型发现使用 provider、baseUrl 和 apiKey', () => {
  const discoverRoute = routeSource.slice(
    routeSource.indexOf("aiRoutes.post('/ai/models/discover'"),
    routeSource.indexOf("aiRoutes.post('/ai/settings/test'"),
  );

  assert.match(discoverRoute, /provider/);
  assert.match(discoverRoute, /baseUrl/);
  assert.match(discoverRoute, /apiKey/);
  assert.match(discoverRoute, /listAiModels/);
});

test('API 挂载 AI 设置路由', () => {
  assert.match(indexSource, /aiRoutes/);
  assert.match(indexSource, /app\.route\('\/api\/v1', aiRoutes\)/);
});
