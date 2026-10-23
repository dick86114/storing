import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const root = new URL('../', import.meta.url);
const routes = readFileSync(new URL('src/routes/articles.ts', root), 'utf8');
const service = readFileSync(new URL('src/services/article-bulk.service.ts', root), 'utf8');
const validation = readFileSync(new URL('src/services/article-bulk-validation.ts', root), 'utf8');

test('批量归档支持提交手工分类，未提交时交给 AI 判断', () => {
  assert.match(validation, /categoryId\?: number \| null/);
  assert.match(routes, /parsed\.categoryId/);
  assert.match(service, /options\.categoryId/);
  assert.match(service, /categorySource: options\.categoryId \? 'user' : 'rule'/);
  assert.match(service, /userSelectedCategory: Boolean\(options\.categoryId\)/);
});

test('用户明确选择由 AI 判断时可以覆盖已确认分类并重新排队', () => {
  assert.match(routes, /resetUserCategory/);
  assert.match(service, /options\.resetUserCategory/);
  assert.match(service, /categorySource: 'rule'/);
  assert.match(service, /categoryReviewStatus: 'needs_review'/);
});

test('批量分类遇到分类不存在或停用时返回可识别的分类不可用', () => {
  const bulkCategoryRoute = routes.slice(
    routes.indexOf("articlesRoutes.post('/articles/bulk-category'"),
    routes.indexOf("articlesRoutes.post('/articles/:id/unarchive'"),
  );

  assert.match(routes, /CategoryServiceError/);
  assert.match(bulkCategoryRoute, /CATEGORY_NOT_FOUND/);
  assert.match(bulkCategoryRoute, /CATEGORY_INACTIVE/);
  assert.match(bulkCategoryRoute, /CATEGORY_UNAVAILABLE/);
  assert.match(bulkCategoryRoute, /404/);
});
