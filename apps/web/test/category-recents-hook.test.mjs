import assert from 'node:assert/strict';
import { test } from 'node:test';

import authContextModule from '../src/components/providers/AuthContext.tsx';
import categoryRecentsModule from '../src/hooks/useCategoryRecents.ts';
import { 安装浏览器环境, 创建根容器, 等待异步更新, React, act } from './test-dom.mjs';

const { AuthProvider } = authContextModule;
const { useCategoryRecents } = categoryRecentsModule;

const 分类 = (id, name) => ({
  id,
  userId: 7,
  name,
  description: null,
  includeExamples: [],
  excludeExamples: [],
  color: null,
  sortOrder: id,
  isActive: true,
  isSystem: false,
  createdAt: null,
  updatedAt: null,
});

function RecentsProbe({ ready, categories }) {
  const { recentCategoryIds } = useCategoryRecents(categories, ready);
  return React.createElement('output', { 'data-testid': 'recents' }, JSON.stringify(recentCategoryIds));
}

test('目录首次加载未就绪时保留已有最近使用，成功加载后再清理失效项', async () => {
  const dom = 安装浏览器环境();
  const storageKey = 'category.recents.7';
  window.localStorage.setItem(storageKey, JSON.stringify([1, 2]));
  globalThis.fetch = async () => new Response(JSON.stringify({
    valid: true,
    user: { id: 7, username: 'category-ux', role: 'user', status: 'active' },
  }), { status: 200, headers: { 'content-type': 'application/json' } });

  const root = 创建根容器();
  await act(async () => {
    root.render(React.createElement(AuthProvider, null,
      React.createElement(RecentsProbe, { ready: false, categories: [] })));
  });
  await 等待异步更新();
  assert.equal(window.localStorage.getItem(storageKey), JSON.stringify([1, 2]));

  await act(async () => {
    root.render(React.createElement(AuthProvider, null,
      React.createElement(RecentsProbe, { ready: true, categories: [分类(1, '工作')] })));
  });
  await 等待异步更新();

  assert.equal(window.localStorage.getItem(storageKey), JSON.stringify([1]));
  assert.equal(document.querySelector('[data-testid="recents"]').textContent, '[1]');
  await act(async () => root.unmount());
  dom.window.close();
});
