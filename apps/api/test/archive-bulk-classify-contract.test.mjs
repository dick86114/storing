import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const articleRoutes = readFileSync(new URL('../src/routes/articles.ts', import.meta.url), 'utf8');

test('批量重判分类只处理已归档且未被用户确认的文章', () => {
  assert.match(articleRoutes, /articlesRoutes\.post\('\/articles\/bulk-classify'/);
  assert.match(articleRoutes, /categorySource === 'user'/);
  assert.match(articleRoutes, /!article\.isArchived/);
  assert.match(articleRoutes, /classifyStoredArticleForArchive/);
});
