import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const articleRoutes = readFileSync(new URL('../src/routes/articles.ts', import.meta.url), 'utf8');
const bulkService = readFileSync(new URL('../src/services/article-bulk.service.ts', import.meta.url), 'utf8');

test('批量重判分类走后台队列且只处理已归档且未被用户确认的文章', () => {
  assert.match(articleRoutes, /articlesRoutes\.post\('\/articles\/bulk-classify'/);
  assert.match(articleRoutes, /includeCategory: true/);
  assert.match(bulkService, /record\.categorySource === 'user'/);
  assert.match(bulkService, /record\.isArchived !== true/);
});
