import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const webRoot = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, webRoot), 'utf8');

test('未归档动作明确说明归档后会进入分类', () => {
  const bulkActionBar = read('src/components/article/BulkActionBar.tsx');
  const articleCard = read('src/components/article/WechatArticleCard.tsx');
  const detailPanel = read('src/components/article/WechatDetailPanel.tsx');

  assert.match(bulkActionBar, /archive: '归档并分类'/);
  assert.match(bulkActionBar, /确认批量归档并分类？/);
  assert.match(bulkActionBar, /下一步可选择分类，或交给 AI 判断/);
  assert.match(articleCard, /article\.isArchived \? '取消归档' : '归档并分类'/);
  assert.match(detailPanel, /article\.isArchived \? '取消归档' : '归档并分类'/);
});

test('归档选择弹层解释分类与归档的先后关系', () => {
  const inbox = read('src/components/content/InboxContent.tsx');
  const favorites = read('src/components/content/FavoritesContent.tsx');
  const detailPanel = read('src/components/article/WechatDetailPanel.tsx');

  for (const source of [inbox, favorites, detailPanel]) {
    assert.match(source, /分类只用于归档文章/);
    assert.match(source, /选择分类后/);
    assert.match(source, /移入「归档」/);
  }
});

test('分类空状态和分类管理说明归档依赖', () => {
  const categoryNavigation = read('src/components/archive/CategoryNavigation.tsx');
  const categorySettings = read('src/components/content/CategorySettingsContent.tsx');

  assert.match(categoryNavigation, /全部归档/);
  assert.match(categoryNavigation, /新建分类/);
  assert.match(categoryNavigation, /管理分类/);
  assert.match(categorySettings, /管理分类/);
  assert.match(categorySettings, /系统分类保持固定/);
});
