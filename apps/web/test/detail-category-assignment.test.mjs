import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const detailPanel = readFileSync(new URL('../src/components/article/WechatDetailPanel.tsx', import.meta.url), 'utf8');

test('文章详情提供分类选择并在保存后刷新归档数据', () => {
  assert.match(detailPanel, /修改分类/);
  assert.match(detailPanel, /api\.getCategories\(\)/);
  assert.match(detailPanel, /api\.moveArticleToCategory\(article\.id, categoryId\)/);
  assert.match(detailPanel, /detailMutate\('categories'\)/);
  assert.match(detailPanel, /detailMutate\('categories:archive-action'\)/);
});
