import assert from 'node:assert/strict';
import { test } from 'node:test';

import categoryManagementModule from '../src/lib/category-management.ts';

const { filterManagementCategories, moveUserCategory, reorderUserCategoryByOffset, resolveSelectedCategoryId } = categoryManagementModule;

const 分类 = (id, name, isSystem = false) => ({
  id,
  userId: 7,
  name,
  description: null,
  includeExamples: [],
  excludeExamples: [],
  color: null,
  sortOrder: id,
  isActive: true,
  isSystem,
  createdAt: null,
  updatedAt: null,
});

test('管理列表按名称包含过滤，系统分类和停用分类仍可被搜索到', () => {
  const categories = [分类(1, '待整理', true), 分类(2, '工作'), { ...分类(3, '旧分类'), isActive: false }];
  assert.deepEqual(filterManagementCategories(categories, '分类').map((item) => item.id), [3]);
  assert.deepEqual(filterManagementCategories(categories, '待').map((item) => item.id), [1]);
});

test('拖拽只移动用户分类并保留系统分类位置', () => {
  const categories = [分类(1, '待整理', true), 分类(2, '工作'), 分类(3, '技术'), 分类(4, '阅读')];
  assert.deepEqual(moveUserCategory(categories, 4, 2).map((item) => item.id), [1, 4, 2, 3]);
  assert.deepEqual(moveUserCategory(categories, 2, 4).map((item) => item.id), [1, 3, 4, 2]);
  assert.deepEqual(moveUserCategory(categories, 1, 2).map((item) => item.id), [1, 2, 3, 4]);
});

test('键盘排序在用户分类边界停止，不会跨过系统分类', () => {
  const categories = [分类(1, '待整理', true), 分类(2, '工作'), 分类(3, '技术'), 分类(4, '阅读')];
  assert.deepEqual(reorderUserCategoryByOffset(categories, 2, -1).map((item) => item.id), [1, 2, 3, 4]);
  assert.deepEqual(reorderUserCategoryByOffset(categories, 2, 1).map((item) => item.id), [1, 3, 2, 4]);
  assert.deepEqual(reorderUserCategoryByOffset(categories, 4, 1).map((item) => item.id), [1, 2, 3, 4]);
});

test('新建分类尚未进入刷新后的目录时，不把选中态重置回系统分类', () => {
  const categories = [分类(1, '待整理', true), 分类(2, '工作')];
  assert.equal(resolveSelectedCategoryId(categories, 9, 9), 9);
  assert.equal(resolveSelectedCategoryId(categories, 2, null), 2);
  assert.equal(resolveSelectedCategoryId(categories, null, null), 1);
});
