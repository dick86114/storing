import assert from 'node:assert/strict';
import { test } from 'node:test';

import authContextModule from '../src/components/providers/AuthContext.tsx';
import toastModule from '../src/components/ui/Toast.tsx';
import categorySettingsModule from '../src/components/content/CategorySettingsContent.tsx';
import { 安装浏览器环境, 创建根容器, 等待异步更新, 等待条件, React, act } from './test-dom.mjs';

const { AuthProvider } = authContextModule;
const { ToastProvider } = toastModule;
const { CategorySettingsContent } = categorySettingsModule;

const categories = [
  { id: 1, userId: 7, name: '待整理', description: null, includeExamples: [], excludeExamples: [], color: '#6B7088', sortOrder: 0, isActive: true, isSystem: true, createdAt: '2026-10-01T00:00:00.000Z', updatedAt: null },
  { id: 2, userId: 7, name: '工作', description: '项目复盘', includeExamples: [], excludeExamples: [], color: '#2F6A4F', sortOrder: 1, isActive: true, isSystem: false, createdAt: '2026-10-02T00:00:00.000Z', updatedAt: null },
];

test('已提交保存后目录刷新失败会显示弱 Toast 和可重试提示', async (t) => {
  const dom = 安装浏览器环境();
  const originalWarn = console.warn;
  const warnings = [];
  console.warn = (...args) => warnings.push(args);
  t.after(() => { console.warn = originalWarn; });
  let failNextCategoryGet = false;
  let categoryGetCount = 0;

  globalThis.fetch = async (input, init = {}) => {
    const url = String(input);
    if (url.endsWith('/verify')) {
      return new Response(JSON.stringify({ valid: true, user: { id: 7, username: 'category-ux', role: 'user', status: 'active' } }), { status: 200 });
    }
    if (url.includes('/categories?includeInactive=true') && (!init.method || init.method === 'GET')) {
      categoryGetCount += 1;
      if (failNextCategoryGet) {
        failNextCategoryGet = false;
        return new Response(JSON.stringify({ error: { code: 'CATALOG_UNAVAILABLE', message: '目录暂不可用' } }), { status: 503 });
      }
      return new Response(JSON.stringify({ categories, counts: { 1: 2, 2: 3 } }), { status: 200 });
    }
    if (url.endsWith('/categories/2') && init.method === 'PATCH') {
      failNextCategoryGet = true;
      return new Response(JSON.stringify({ category: { ...categories[1], description: '项目复盘（更新）' } }), { status: 200 });
    }
    return new Response(JSON.stringify({}), { status: 200 });
  };

  const root = 创建根容器();
  await act(async () => {
    root.render(React.createElement(AuthProvider, null,
      React.createElement(ToastProvider, null,
        React.createElement(CategorySettingsContent))));
  });
  await 等待异步更新();

  const workRow = [...document.querySelectorAll('button')].find((item) => item.textContent.includes('工作'));
  await act(async () => workRow.dispatchEvent(new window.MouseEvent('click', { bubbles: true })));
  const form = document.querySelector('.category-management-form');
  await act(async () => {
    form.dispatchEvent(new window.Event('submit', { bubbles: true, cancelable: true }));
  });
  await 等待条件(() => document.body.textContent.includes('操作已提交，分类目录刷新失败，请稍后重试'));

  assert.ok(categoryGetCount >= 2);
  assert.ok(document.body.textContent.includes('操作已提交，分类目录刷新失败，请稍后重试'));
  assert.ok(warnings.some((args) => String(args[0]).includes('分类操作已提交，但刷新目录失败')));
  const retry = [...document.querySelectorAll('button')].find((item) => item.textContent.includes('重试刷新'));
  assert.ok(retry, '应提供组件内目录刷新重试入口');

  await act(async () => retry.dispatchEvent(new window.MouseEvent('click', { bubbles: true })));
  await 等待条件(() => ![...document.querySelectorAll('button')].some((item) => item.textContent.includes('重试刷新')));
  assert.equal([...document.querySelectorAll('button')].some((item) => item.textContent.includes('重试刷新')), false);
  await act(async () => root.unmount());
  dom.window.close();
});
