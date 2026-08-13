import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('分类 API、文章归档和 AI 受控分类使用同一套分类契约', async () => {
  const [index, articleRoutes, aiService, collectService] = await Promise.all([
    readFile(new URL('../src/index.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/routes/articles.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/services/ai.service.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/services/collect.service.ts', import.meta.url), 'utf8'),
  ]);

  assert.match(index, /categoriesRoutes/);
  assert.match(index, /app\.route\('\/api\/v1', categoriesRoutes\)/);
  assert.match(articleRoutes, /c\.req\.query\('categoryId'\)/);
  assert.match(articleRoutes, /articlesRoutes\.patch\('\/articles\/:id\/category'/);
  assert.match(articleRoutes, /articlesRoutes\.post\('\/articles\/bulk-category'/);
  assert.match(articleRoutes, /articlesRoutes\.post\('\/articles\/:id\/classify'/);
  assert.match(articleRoutes, /classifyStoredArticleForArchive/);
  assert.match(articleRoutes, /getPendingCategory\(userId\)/);
  assert.match(collectService, /getPendingCategory\(options\.userId\)/);
  assert.match(aiService, /category_id/);
  assert.match(aiService, /只允许从以下分类 ID 中选择/);
});
