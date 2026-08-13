import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('分类说明优化接口使用现有 AI 服务并返回可编辑的分类规则草案', async () => {
  const [routes, aiService] = await Promise.all([
    readFile(new URL('../src/routes/categories.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/services/ai.service.ts', import.meta.url), 'utf8'),
  ]);

  assert.match(routes, /categoriesRoutes\.post\('\/categories\/optimize-description'/);
  assert.match(routes, /optimizeCategoryDescription/);
  assert.match(aiService, /export async function optimizeCategoryDescription/);
  assert.match(aiService, /include_examples/);
  assert.match(aiService, /exclude_examples/);
  assert.match(aiService, /仅输出 JSON/);
});

test('删除分类会先迁移归档文章，再真正删除分类', async () => {
  const [routes, service] = await Promise.all([
    readFile(new URL('../src/routes/categories.ts', import.meta.url), 'utf8'),
    readFile(new URL('../src/services/category.service.ts', import.meta.url), 'utf8'),
  ]);

  assert.match(routes, /deleteCategory/);
  assert.match(routes, /categoriesRoutes\.delete\('\/categories\/:id'/);
  assert.match(service, /export async function deleteCategory/);
  assert.match(service, /DELETE FROM \$\{categories\}/);
});
