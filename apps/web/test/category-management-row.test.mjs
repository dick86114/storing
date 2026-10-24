import assert from 'node:assert/strict';
import { test } from 'node:test';

import categoryManagementRowModule from '../src/components/category/CategoryManagementRow.tsx';
import { 安装浏览器环境, 创建根容器, React, act } from './test-dom.mjs';

const { CategoryManagementRow } = categoryManagementRowModule;

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

function 拖拽事件(type, dataTransfer) {
  const event = new window.Event(type, { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', { value: dataTransfer });
  return event;
}

test('只有拖拽手柄启动排序，整行作为落点并保留整行拖动预览', async () => {
  const dom = 安装浏览器环境();
  const dragStarts = [];
  const dropped = [];
  const selected = [];
  const previews = [];
  const dataTransfer = {
    effectAllowed: '',
    setData() {},
    setDragImage(element, x, y) { previews.push({ element, x, y }); },
  };
  const root = 创建根容器();
  await act(async () => {
    root.render(React.createElement(CategoryManagementRow, {
      category: 分类,
      count: 3,
      selected: false,
      first: true,
      last: true,
      locked: false,
      draggedId: 2,
      onSelect: () => selected.push(2),
      onMove() {},
      onDragStart: (id) => dragStarts.push(id),
      onDragEnd() {},
      onDragOver() {},
      onDrop: (id) => dropped.push(id),
    }));
  });

  const row = document.querySelector('[data-category-row-id="2"]');
  const handle = document.querySelector('[aria-label*="拖动工作排序"]');
  const body = document.querySelector('.category-management-row-main');
  assert.notEqual(row.getAttribute('draggable'), 'true');
  assert.notEqual(body.getAttribute('draggable'), 'true');
  assert.equal(handle.getAttribute('draggable'), 'true');

  await act(async () => {
    handle.dispatchEvent(拖拽事件('dragstart', dataTransfer));
  });
  assert.deepEqual(dragStarts, [2]);
  assert.equal(previews[0].element, row);

  await act(async () => {
    body.dispatchEvent(拖拽事件('dragstart', dataTransfer));
  });
  assert.deepEqual(dragStarts, [2]);

  await act(async () => {
    body.dispatchEvent(new window.MouseEvent('click', { bubbles: true }));
  });
  assert.deepEqual(selected, [2]);
  assert.deepEqual(dragStarts, [2]);

  await act(async () => {
    row.dispatchEvent(拖拽事件('dragover', dataTransfer));
    row.dispatchEvent(拖拽事件('drop', dataTransfer));
  });
  assert.deepEqual(dropped, [2]);
  await act(async () => root.unmount());
  dom.window.close();
});
