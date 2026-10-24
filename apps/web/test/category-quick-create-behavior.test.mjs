import assert from 'node:assert/strict';
import { test } from 'node:test';

import categoryQuickCreateModule from '../src/components/category/CategoryQuickCreateDialog.tsx';
import { 安装浏览器环境, 创建根容器, 修改输入, 等待条件, React, act } from './test-dom.mjs';

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

test('AI 优化入口位于详细规则说明下方并会填充生成的规则', async () => {
  const dom = 安装浏览器环境();
  const { api } = await import('../src/lib/api.ts');
  const originalOptimize = api.optimizeCategoryDescription;
  const calls = [];
  api.optimizeCategoryDescription = async (input) => {
    calls.push(input);
    return {
      draft: {
        description: '生成后的分类说明',
        includeExamples: ['产品设计方法'],
        excludeExamples: ['纯行业新闻'],
      },
    };
  };
  const root = 创建根容器();

  try {
    await act(async () => {
      root.render(React.createElement(CategoryQuickCreateDialog, {
        categories: [],
        onClose() {},
        onCreate: async () => { throw new Error('本测试不创建分类'); },
        onCreated() {},
      }));
    });

    const nameInput = document.querySelector('input[placeholder="例如：产品设计"]');
    await act(async () => 修改输入(nameInput, '产品设计'));

    const details = document.querySelector('.category-quick-create-details');
    const intro = details.querySelector(':scope > p');
    const aiRow = details.querySelector('.category-quick-create-ai-row');
    const optimizeButton = aiRow.querySelector('.category-quick-create-optimize');
    const firstField = details.querySelector('label.category-form-field');
    assert.ok(intro);
    assert.ok(aiRow);
    assert.ok(optimizeButton);
    assert.ok(firstField);
    assert.ok(
      intro.compareDocumentPosition(aiRow) & window.Node.DOCUMENT_POSITION_FOLLOWING,
      'AI 优化入口应位于详细规则说明下方',
    );
    assert.ok(
      aiRow.compareDocumentPosition(firstField) & window.Node.DOCUMENT_POSITION_FOLLOWING,
      'AI 优化入口应位于具体规则控件之前',
    );
    assert.match(details.textContent, /AI 会根据分类名称和当前规则/);
    assert.equal(optimizeButton.textContent.trim(), 'AI 优化');

    await act(async () => optimizeButton.dispatchEvent(new window.MouseEvent('click', { bubbles: true })));
    await 等待条件(() => document.querySelector('textarea[placeholder="说明这个分类适合收录哪些文章"]').value === '生成后的分类说明');

    assert.deepEqual(calls[0], {
      name: '产品设计',
      description: null,
      includeExamples: [],
      excludeExamples: [],
    });
  } finally {
    api.optimizeCategoryDescription = originalOptimize;
    await act(async () => root.unmount());
    dom.window.close();
  }
});
