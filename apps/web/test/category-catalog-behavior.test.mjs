import assert from 'node:assert/strict';
import { test } from 'node:test';

import categoryCatalogModule from '../src/lib/category-catalog.ts';

const {
  activeCategoriesFrom,
  categoryCatalogKey,
  categoryRecentsStorageKey,
  readCategoryRecents,
  rememberCategoryRecent,
} = categoryCatalogModule;

class 内存存储 {
  constructor(initial = {}) {
    this.values = new Map(Object.entries(initial));
  }

  getItem(key) {
    return this.values.get(key) ?? null;
  }

  setItem(key, value) {
    this.values.set(key, value);
  }
}

const 分类 = (id, name, isActive = true) => ({
  id,
  userId: 7,
  name,
  description: null,
  includeExamples: [],
  excludeExamples: [],
  color: null,
  sortOrder: id,
  isActive,
  isSystem: false,
  createdAt: null,
  updatedAt: null,
});

test('分类目录 key 包含用户 ID，只向界面暴露启用分类', () => {
  assert.equal(categoryCatalogKey(7), 'categories:user:7');
  assert.notEqual(categoryCatalogKey(7), categoryCatalogKey(8));
  assert.deepEqual(
    activeCategoriesFrom({ categories: [分类(1, '工作'), 分类(2, '旧分类', false)] }).map((item) => item.name),
    ['工作'],
  );
});

test('最近使用按用户隔离，读取时清理失效和重复分类并限制为 5 个', () => {
  const storage = new 内存存储();
  const valid = new Set([1, 3, 4, 5, 6, 7]);

  assert.equal(categoryRecentsStorageKey(7), 'category.recents.7');
  rememberCategoryRecent(storage, 7, 3, valid);
  rememberCategoryRecent(storage, 7, 1, valid);
  rememberCategoryRecent(storage, 7, 3, valid);
  rememberCategoryRecent(storage, 7, 4, valid);
  rememberCategoryRecent(storage, 7, 5, valid);
  rememberCategoryRecent(storage, 7, 6, valid);
  rememberCategoryRecent(storage, 7, 7, valid);

  assert.deepEqual(readCategoryRecents(storage, 7, new Set([3, 4, 5, 6, 7])), [7, 6, 5, 4, 3]);
  assert.deepEqual(readCategoryRecents(storage, 8, valid), []);
  assert.equal(JSON.parse(storage.getItem('category.recents.7')).length, 5);

  storage.setItem('category.recents.7', JSON.stringify([99, 3, 3, 2, 7]));
  assert.deepEqual(readCategoryRecents(storage, 7, new Set([3, 7])), [3, 7]);
  assert.equal(storage.getItem('category.recents.7'), JSON.stringify([3, 7]));
});

test('损坏的最近使用缓存按空列表处理，不阻断分类选择', () => {
  const storage = new 内存存储({ 'category.recents.7': '{not-json' });
  assert.deepEqual(readCategoryRecents(storage, 7, new Set([1])), []);
});
