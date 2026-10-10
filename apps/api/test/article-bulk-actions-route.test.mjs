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
