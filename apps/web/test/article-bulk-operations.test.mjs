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

test('批量动作收进下拉并全部使用统一确认弹窗', () => {
  const actionBar = read('src/components/article/BulkActionBar.tsx');

  assert.match(actionBar, /批量操作/);
  assert.match(actionBar, /批量动作/);
  assert.match(actionBar, /bulk-actions-menu/);
  assert.match(actionBar, /ACTION_CONFIRMATIONS: Record<BulkToolbarAction, /);
  assert.match(actionBar, /确认批量删除？/);
  assert.match(actionBar, /确认批量彻底删除？/);
  assert.match(actionBar, /不可恢复/);
  assert.match(actionBar, /confirm-dialog-overlay/);
  assert.match(actionBar, /confirm-dialog-panel/);
  assert.doesNotMatch(actionBar, /export-obsidian/);
});

test('批量结果展示成功、跳过、失败和公开链接', () => {
  const actionBar = read('src/components/article/BulkActionBar.tsx');

  assert.match(actionBar, /confirm-dialog-panel/);
  assert.match(actionBar, /成功/);
  assert.match(actionBar, /跳过/);
  assert.match(actionBar, /失败/);
  assert.match(actionBar, /publications/);
});

test('批量导出任务轮询状态并提供下载入口', () => {
  const actionBar = read('src/components/article/BulkActionBar.tsx');

  assert.match(actionBar, /exportJob\?: BulkExportJob \| null/);
  assert.match(actionBar, /api\.getBulkExport\(trackedJob\.id\)/);
  assert.match(actionBar, /下载 ZIP/);
  assert.match(actionBar, /导出失败/);
});

test('批量模式点击卡片主体切换选择', () => {
  const articleCard = read('src/components/article/WechatArticleCard.tsx');

  assert.match(articleCard, /selectable \? onCardClick/);
  assert.match(articleCard, /onSelectionChange\?\.\(article\.id, !selected/);
  assert.match(articleCard, /event\.stopPropagation\(\)/);
});

test('四个列表复用统一批量操作栏', () => {
  for (const file of ['InboxContent.tsx', 'FavoritesContent.tsx', 'ArchiveContent.tsx', 'PublishedContent.tsx']) {
    const source = read(`src/components/content/${file}`);
    assert.match(source, /useArticleSelection/, file);
    assert.match(source, /<BulkActionBar/, file);
    assert.match(source, /selectable=\{bulkMode\}/, file);
  }
});
