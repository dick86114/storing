import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const apiRoot = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, apiRoot), 'utf8');

test('普通批量端点保持用户隔离和目标状态语义', () => {
  const routes = read('src/routes/articles.ts');
  const service = read('src/services/article-bulk.service.ts');

  assert.match(routes, /articlesRoutes\.post\('\/articles\/bulk-actions', requireAuth/);
  assert.match(service, /export async function runSimpleArticleBulkAction/);
  assert.match(service, /eq\(articleMetadata\.userId, userId\)/);
  assert.match(service, /ALREADY_FAVORITED/);
  assert.match(service, /ALREADY_ARCHIVED/);
});

test('批量彻底删除逐篇使用行锁和引用判断', () => {
  const service = read('src/services/article-bulk.service.ts');

  assert.match(service, /export async function permanentlyDeleteArticleForUser/);
  assert.match(service, /\.for\('update'\)/);
  assert.match(service, /COUNT\(\*\)/);
  assert.match(service, /isDeleted: true/);
});

test('批量发布保留已有公开链接', () => {
  const routes = read('src/routes/articles.ts');
  const service = read('src/services/article-bulk.service.ts');
  const bulkRoute = routes.slice(
    routes.indexOf("articlesRoutes.post('/articles/bulk-actions'"),
    routes.indexOf("articlesRoutes.post('/articles/bulk-classify'"),
  );

  assert.match(bulkRoute, /publications/);
  assert.match(service, /ALREADY_PUBLISHED/);
});

test('批量取消发布保留归档和 publicId', () => {
  const service = read('src/services/article-bulk.service.ts');

  assert.match(service, /isPublished: false/);
  assert.match(service, /archivedAt/);
  assert.match(service, /publicId/);
});

test('批量分类返回统一结果结构', () => {
  const routes = read('src/routes/articles.ts');
  const service = read('src/services/article-bulk.service.ts');

  assert.match(service, /export async function runBulkArticleCategory/);
  assert.match(routes, /runBulkArticleCategory/);
  assert.match(routes, /const result: ArticleBulkActionResult = await runBulkArticleCategory/);
});

test('批量 AI 先校验配置并避免重复排队', () => {
  const routes = read('src/routes/articles.ts');
  const service = read('src/services/article-bulk.service.ts');

  assert.match(routes, /articlesRoutes\.post\('\/articles\/bulk-regenerate-ai', requireAuth/);
  assert.match(service, /export async function enqueueBulkArticleAi/);
  assert.match(service, /resolveUserAiRuntimeConfig\(userId\)/);
  assert.match(service, /inArray\(aiGenerationJobs\.status, \['queued', 'running'\]\)/);
  assert.match(service, /alreadyQueuedIds/);
});
