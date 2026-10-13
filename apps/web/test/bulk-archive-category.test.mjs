import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const api = read('../src/lib/api.ts');
const inbox = read('../src/components/content/InboxContent.tsx');
const favorites = read('../src/components/content/FavoritesContent.tsx');
const archive = read('../src/components/content/ArchiveContent.tsx');
const detail = read('../src/components/article/WechatDetailPanel.tsx');

test('批量归档会先选择分类或交给 AI 判断', () => {
  assert.match(api, /bulkArticles:\s*\(\s*action: ArticleBulkAction,\s*articleIds: number\[\],\s*categoryId\?: number/);
  assert.match(inbox, /bulkArchivePickerOpen/);
  assert.match(inbox, /onSelectAi=\{\(\) => confirmBulkArchive\(\)\}/);
  assert.match(favorites, /bulkArchivePickerOpen/);
  assert.match(favorites, /onSelectAi=\{\(\) => confirmBulkArchive\(\)\}/);
});

test('批量设置分类弹窗提供由 AI 判断入口', () => {
  assert.match(archive, /onSelectAi=\{handleBulkCategoryAi\}/);
  assert.match(archive, /bulkActions\.runAi\(ids, true, true\)/);
});

test('单篇修改分类弹窗提供由 AI 判断入口', () => {
  assert.match(detail, /moveCategoryPickerOpen[\s\S]*?onSelectAi=\{handleReclassifyCategory\}/);
});
