import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const repoRoot = new URL('../../../', import.meta.url);
const read = (path) => readFileSync(new URL(path, repoRoot), 'utf8');

test('侧边栏绑定资料库计数且搜索路由使用生产列表视图', () => {
  const root = read('apps/macos/QiankunjieMac/App/RootWindow.swift');
  const sidebar = read('apps/macos/QiankunjieMac/App/SidebarView.swift');

  assert.match(root, /model\.destination == \.search/);
  assert.match(root, /LibrarySearchView/);
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
