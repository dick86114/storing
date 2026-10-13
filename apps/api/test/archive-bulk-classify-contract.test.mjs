import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const articleRoutes = readFileSync(new URL('../src/routes/articles.ts', import.meta.url), 'utf8');
const bulkService = readFileSync(new URL('../src/services/article-bulk.service.ts', import.meta.url), 'utf8');

test('批量重判分类走后台队列，普通入口不覆盖用户确认分类', () => {
  assert.match(articleRoutes, /articlesRoutes\.post\('\/articles\/bulk-classify'/);
  assert.match(articleRoutes, /includeCategory: true/);
  assert.match(bulkService, /record\.isArchived !== true/);
});

test('用户明确选择由 AI 判断时可以覆盖已确认分类并重新排队', () => {
  assert.match(articleRoutes, /resetUserCategory/);
  assert.match(bulkService, /options\.resetUserCategory/);
  assert.match(bulkService, /categorySource: 'rule'/);
  assert.match(bulkService, /categoryReviewStatus: 'needs_review'/);
});
