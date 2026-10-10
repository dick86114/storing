import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const webRoot = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, webRoot), 'utf8');

test('批量客户端提供统一 API 和选择方法', () => {
  const api = read('src/lib/api.ts');
  const selection = read('src/hooks/useArticleSelection.ts');
  const actions = read('src/hooks/useBulkArticleActions.ts');

  assert.match(api, /bulkArticles: \(action: ArticleBulkAction, articleIds: number\[\]\)/);
  assert.match(api, /bulkSetCategory/);
  assert.match(api, /bulkRegenerateArticleAi/);
  assert.match(api, /createBulkExport/);
  assert.match(selection, /export function useArticleSelection/);
  assert.match(selection, /selectAllLoaded/);
  assert.match(actions, /export function useBulkArticleActions/);
});
