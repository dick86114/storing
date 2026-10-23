import assert from 'node:assert/strict';
import { test } from 'node:test';

import categoryQuickCreateModule from '../src/components/category/CategoryQuickCreateDialog.tsx';
import { 安装浏览器环境, 创建根容器, 修改输入, React, act } from './test-dom.mjs';

const { CategoryQuickCreateDialog } = categoryQuickCreateModule;

const 分类 = {
  id: 2,
  userId: 7,
  name: '工作',
  description: null,
  includeExamples: [],
  excludeExamples: [],
  color: '#2F6A4F',
  sortOrder: 2,
  isActive: true,
  isSystem: false,
  createdAt: null,
  updatedAt: null,
};

test('选择同名现有分类时明确标记 reusedExisting，不误报为新建', async () => {
  const dom = 安装浏览器环境();
  const completed = [];
  const root = 创建根容器();
  await act(async () => {
    root.render(React.createElement(CategoryQuickCreateDialog, {
      categories: [分类],
      onClose() {},
      onCreate: async () => { throw new Error('不应创建重复分类'); },
      onCreated: (category, meta) => completed.push({ category, meta }),
    }));
  });

  const input = document.querySelector('input[placeholder="例如：产品设计"]');
  await act(async () => 修改输入(input, '工作'));
  const reuse = [...document.querySelectorAll('button')].find((item) => item.textContent.includes('使用现有分类'));
  await act(async () => reuse.dispatchEvent(new window.MouseEvent('click', { bubbles: true })));

  assert.equal(completed.length, 1);
  assert.equal(completed[0].category.id, 2);
  assert.equal(completed[0].meta.reusedExisting, true);
  await act(async () => root.unmount());
  dom.window.close();
});
