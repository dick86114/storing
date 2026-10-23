import assert from 'node:assert/strict';
import { test } from 'node:test';
import { JSDOM } from 'jsdom';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

import categoryPickerComponentModule from '../src/components/category/CategoryPicker.tsx';

const { CategoryPicker } = categoryPickerComponentModule;

const 分类 = (id, name) => ({
  id,
  userId: 7,
  name,
  description: null,
  includeExamples: [],
  excludeExamples: [],
  color: '#2F6A4F',
  sortOrder: id,
  isActive: true,
  isSystem: false,
  createdAt: null,
  updatedAt: null,
});

function 安装浏览器环境() {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost:1050' });
  globalThis.window = dom.window;
  globalThis.document = dom.window.document;
  globalThis.HTMLElement = dom.window.HTMLElement;
  globalThis.HTMLInputElement = dom.window.HTMLInputElement;
  globalThis.Node = dom.window.Node;
  globalThis.Event = dom.window.Event;
  globalThis.InputEvent = dom.window.InputEvent;
  globalThis.KeyboardEvent = dom.window.KeyboardEvent;
  globalThis.MouseEvent = dom.window.MouseEvent;
  globalThis.ShadowRoot = dom.window.ShadowRoot;
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true });
  dom.window.HTMLElement.prototype.attachEvent = () => {};
  dom.window.HTMLElement.prototype.detachEvent = () => {};
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  return dom;
}

function 创建根容器() {
  const container = document.createElement('div');
  document.body.append(container);
  return createRoot(container);
}

function 修改输入(input, value) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  setter.call(input, value);
  input.dispatchEvent(new window.InputEvent('input', { bubbles: true, inputType: 'insertText', data: value }));
  input.dispatchEvent(new window.Event('change', { bubbles: true }));
}

test('选择器打开后聚焦搜索框，关闭后焦点返回触发按钮', async () => {
  const dom = 安装浏览器环境();
  const trigger = document.createElement('button');
  trigger.textContent = '修改分类';
  document.body.append(trigger);
  trigger.focus();

  const root = 创建根容器();
  await act(async () => {
    root.render(React.createElement(CategoryPicker, {
      categories: [分类(1, '工作')],
      recentCategoryIds: [],
      currentCategoryId: null,
      onClose() {},
      onSelect: async () => ({ status: 'success' }),
    }));
  });

  assert.equal(document.activeElement?.getAttribute('role'), 'combobox');
  await act(async () => root.unmount());
  assert.equal(document.activeElement, trigger);
  dom.window.close();
});

test('搜索同名分类后按 Enter 使用现有分类，成功回调后再关闭选择器', async () => {
  const dom = 安装浏览器环境();
  const selected = [];
  const completed = [];
  let closed = 0;
  const root = 创建根容器();
  await act(async () => {
    root.render(React.createElement(CategoryPicker, {
      categories: [分类(1, '工作'), 分类(2, '阅读')],
      recentCategoryIds: [2],
      currentCategoryId: null,
      onClose: () => { closed += 1; completed.push('close'); },
      onSelect: async (id) => { selected.push(id); return { status: 'success', message: `已归入分类 ${id}` }; },
      onNotify() { completed.push('notify'); },
      onRememberCategory() { completed.push('remember'); },
    }));
  });

  const input = document.querySelector('[role="combobox"]');
  await act(async () => 修改输入(input, '工作'));
  await act(async () => {
    input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  });

  assert.deepEqual(selected, [1]);
  assert.equal(closed, 1);
  assert.deepEqual(completed, ['remember', 'notify', 'close']);
  await act(async () => root.unmount());
  dom.window.close();
});

test('方向键移动高亮，Enter 执行当前分类，Escape 关闭选择器', async () => {
  const dom = 安装浏览器环境();
  const selected = [];
  let closed = 0;
  const root = 创建根容器();
  await act(async () => {
    root.render(React.createElement(CategoryPicker, {
      categories: [分类(1, '工作'), 分类(2, '阅读')],
      recentCategoryIds: [],
      currentCategoryId: null,
      onClose: () => { closed += 1; },
      onSelect: async (id) => { selected.push(id); return { status: 'success' }; },
    }));
  });

  const input = document.querySelector('[role="combobox"]');
  await act(async () => {
    input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
  });
  await act(async () => {
    input.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  });
  assert.deepEqual(selected, [2]);
  assert.equal(closed, 1);
  await act(async () => root.unmount());
  dom.window.close();

  const escapeDom = 安装浏览器环境();
  let escapeClosed = 0;
  const escapeRoot = 创建根容器();
  await act(async () => {
    escapeRoot.render(React.createElement(CategoryPicker, {
      categories: [分类(1, '工作')],
      recentCategoryIds: [],
      currentCategoryId: null,
      onClose: () => { escapeClosed += 1; },
      onSelect: async () => ({ status: 'success' }),
    }));
  });
  await act(async () => {
    document.querySelector('[role="combobox"]').dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  });
  assert.equal(escapeClosed, 1);
  await act(async () => escapeRoot.unmount());
  escapeDom.window.close();
});

test('大批量部分成功时保留选择器并展示成功、跳过、失败数量', async () => {
  const dom = 安装浏览器环境();
  const remembered = [];
  const root = 创建根容器();
  await act(async () => {
    root.render(React.createElement(CategoryPicker, {
      categories: [分类(1, '工作')],
      recentCategoryIds: [],
      currentCategoryId: null,
      targetCount: 3,
      onClose() {},
      onRememberCategory: (id) => remembered.push(id),
      onSelect: async () => ({ status: 'partial', succeededCount: 1, skippedCount: 1, failedCount: 1 }),
    }));
  });

  const option = [...document.querySelectorAll('button')].find((item) => item.textContent.includes('工作'));
  await act(async () => option.dispatchEvent(new window.MouseEvent('click', { bubbles: true })));

  assert.ok(document.body.textContent.includes('成功 1'));
  assert.ok(document.body.textContent.includes('跳过 1'));
  assert.ok(document.body.textContent.includes('失败 1'));
  assert.ok(document.body.textContent.includes('文章尚未全部分类'));
  assert.deepEqual(remembered, [1]);
  await act(async () => root.unmount());
  dom.window.close();
});

test('创建成功但分类失败时保留输入上下文并显示明确错误', async () => {
  const dom = 安装浏览器环境();
  let createdName = '';
  const root = 创建根容器();
  await act(async () => {
    root.render(React.createElement(CategoryPicker, {
      categories: [分类(1, '工作')],
      recentCategoryIds: [],
      currentCategoryId: null,
      onClose() {},
      onCreateCategory: async (name) => {
        createdName = name;
        return { category: 分类(9, name) };
      },
      onSelect: async () => ({ status: 'failure', message: '网络中断' }),
    }));
  });

  const input = document.querySelector('[role="combobox"]');
  await act(async () => 修改输入(input, '产品设计'));
  const createButton = [...document.querySelectorAll('button')].find((item) => item.textContent.includes('创建“产品设计”并分类'));
  await act(async () => {
    createButton.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
    await Promise.resolve();
  });

  assert.equal(createdName, '产品设计');
  assert.ok(document.body.textContent.includes('分类已创建，但文章尚未分类，请重试'));
  assert.ok(document.querySelector('[role="combobox"]'));
  await act(async () => root.unmount());
  dom.window.close();
});
