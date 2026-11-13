import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const routeSource = readFileSync(new URL('../src/routes/deep-analysis.ts', import.meta.url), 'utf8');
const articlesRoute = readFileSync(new URL('../src/routes/articles.ts', import.meta.url), 'utf8');
const indexSource = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8');

test('深度报告接口要求登录并使用认证用户', () => {
  for (const path of ['/articles/:id/deep-analysis', '/articles/:id/deep-analysis/versions', '/articles/:id/deep-analysis/:version/restore']) {
    assert.ok(routeSource.includes(path), path);
  }
  assert.ok((routeSource.match(/requireAuth/g) || []).length >= 4);
  assert.match(routeSource, /getCurrentUser\(c\)\.id as number/);
});

test('文章归属校验优先于任务提交和报告读取', () => {
  assert.match(routeSource, /getArticleRecord\(articleId, userId\)/);
  assert.match(routeSource, /return c\.json\(\{ error: \{ code: 'NOT_FOUND'/);
});

test('接口覆盖报告、版本、恢复和稳定错误码', () => {
  assert.match(routeSource, /enqueueDeepAnalysis/);
  assert.match(routeSource, /getDeepAnalysisSummary/);
  assert.match(routeSource, /getDeepAnalysisVersions/);
  assert.match(routeSource, /restoreDeepAnalysisVersion/);
  assert.match(routeSource, /AI_NOT_CONFIGURED/);
  assert.match(routeSource, /DEEP_ANALYSIS_BODY_NOT_FOUND/);
});

test('列表与详情响应返回深度报告状态', () => {
  assert.match(articlesRoute, /deepAnalysis: deepAnalysisMap\.get\(article\.id\) \?\? deepAnalysisFallback/);
  assert.match(articlesRoute, /deepAnalysis: await getDeepAnalysisSummary\(userId, article\.id\)/);
  assert.match(articlesRoute, /attachDeepAnalysisSummaries/);
});

test('通知接口注册到应用并要求登录', () => {
  assert.match(routeSource, /notifications/);
  assert.match(routeSource, /listUserNotifications/);
  assert.match(routeSource, /markUserNotificationRead/);
  assert.match(indexSource, /deepAnalysisRoutes/);
  assert.match(indexSource, /app\.route\('\/api\/v1', deepAnalysisRoutes\)/);
});

test('恢复历史版本只切换当前指针，不修改报告内容', () => {
  assert.match(routeSource, /restoreDeepAnalysisVersion/);
  assert.match(routeSource, /当前版本已恢复/);
  assert.doesNotMatch(routeSource, /reportJson: null/);
});
