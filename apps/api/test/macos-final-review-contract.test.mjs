import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const repoRoot = new URL('../../../', import.meta.url);
const read = (path) => readFileSync(new URL(path, repoRoot), 'utf8');

test('搜索入口独立于侧栏并返回多端封面', () => {
  const root = read('apps/macos/QiankunjieMac/App/RootWindow.swift');
  const sidebar = read('apps/macos/QiankunjieMac/App/SidebarView.swift');
  const search = read('apps/api/src/routes/search.ts');

  assert.doesNotMatch(root, /model\.destination == \.search/);
  assert.match(root, /SearchWorkspaceView/);
  assert.match(root, /SearchResultCoverView/);
  assert.match(search, /metadataCoverImage: articleMetadata\.coverImage/);
  assert.match(search, /coverImage: a\.metadataCoverImage \|\| a\.articleCoverImage/);
  assert.match(sidebar, /model\.libraryModel\.count\(for:/);
});

test('阅读器原生头部展示 ArticleDetail 的完整元数据', () => {
  const reader = read('apps/macos/QiankunjieMac/Features/Reader/ReaderPaneView.swift');

  for (const text of [
    'article.title',
    'article.source',
    'article.author',
    'article.publishTime',
    'statusText(for: article)',
    'article.category',
    'article.aiTags',
  ]) {
    assert.ok(reader.includes(text), `阅读器头部应包含 ${text}`);
  }
});

test('macOS 更新安装前必须让用户确认或稍后处理', () => {
  const view = read('apps/macos/QiankunjieMac/Features/Settings/UpdateSettingsView.swift');

  assert.match(view, /isInstallConfirmationPresented/);
  assert.match(view, /立即退出并安装/);
  assert.match(view, /稍后/);
});
