import assert from 'node:assert/strict';
import { test } from 'node:test';

import categoryPickerModule from '../src/lib/category-picker.ts';

const {
  buildCategoryPickerSections,
  bulkCategoryOutcome,
  commitSingleArchiveAssignment,
  filterPickerCategories,
  nextPickerIndex,
} = categoryPickerModule;

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

test('搜索按名称包含匹配，同名时只提供既有分类而不提供创建', () => {
  const categories = [分类(1, '工作'), 分类(2, '工作方法'), 分类(3, '阅读')];
  assert.deepEqual(filterPickerCategories(categories, '工作').map((item) => item.id), [1, 2]);

  const exact = buildCategoryPickerSections(categories, [2], '工作');
  assert.equal(exact.exactCategory?.id, 1);
  assert.equal(exact.canCreate, false);
  assert.deepEqual(exact.recent.map((item) => item.id), [2]);

  const absent = buildCategoryPickerSections(categories, [], '产品设计');
  assert.equal(absent.exactCategory, null);
  assert.equal(absent.canCreate, true);
});

test('键盘序号在首尾循环，空列表保持 -1', () => {
  assert.equal(nextPickerIndex(-1, 1, 3), 0);
  assert.equal(nextPickerIndex(0, 1, 3), 1);
  assert.equal(nextPickerIndex(2, 1, 3), 0);
  assert.equal(nextPickerIndex(0, -1, 3), 2);
  assert.equal(nextPickerIndex(0, 1, 0), -1);
});

test('批量分类将部分成功和全部失败区分为不同结果', () => {
  const partial = bulkCategoryOutcome({
    requestedCount: 3,
    succeededIds: [1],
    skipped: [{ articleId: 2, code: 'NOT_ARCHIVED' }],
    failed: [{ articleId: 3, code: 'UPDATE_FAILED', message: '写入失败' }],
  }, '已分类');
  assert.equal(partial.status, 'partial');
  assert.equal(partial.succeededCount, 1);
  assert.equal(partial.skippedCount, 1);
  assert.equal(partial.failedCount, 1);

  const failed = bulkCategoryOutcome({
    requestedCount: 2,
    succeededIds: [],
    skipped: [{ articleId: 1, code: 'NOT_ARCHIVED' }],
    failed: [{ articleId: 2, code: 'UPDATE_FAILED' }],
  }, '已分类');
  assert.equal(failed.status, 'failure');
  assert.equal(failed.skippedCount, 1);
  assert.equal(failed.failedCount, 1);
});

test('单篇归档核心成功后，辅助 catalog/list 刷新失败不影响成功结果', async () => {
  const events = [];
  const result = await commitSingleArchiveAssignment({
    commit: async () => events.push(['commit']),
    onCommitted: () => events.push(['committed']),
    refreshAuxiliary: async () => {
      events.push(['refresh']);
      throw new Error('list refresh failed');
    },
    onRefreshWarning: (error) => events.push(['warning', error.message]),
    successMessage: '已归档',
    failureMessage: '归档失败',
  });

  assert.equal(result.status, 'success');
  assert.equal(result.message, '已归档');
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(events, [['commit'], ['committed'], ['refresh'], ['warning', 'list refresh failed']]);
});

test('单篇归档核心失败时不提示成功，也不触发辅助刷新', async () => {
  const events = [];
  const result = await commitSingleArchiveAssignment({
    commit: async () => { throw new Error('archive failed'); },
    onCommitted: () => events.push(['committed']),
    refreshAuxiliary: async () => events.push(['refresh']),
    onRefreshWarning: () => events.push(['warning']),
    successMessage: '已归档',
    failureMessage: '归档失败',
  });

  assert.equal(result.status, 'failure');
  assert.equal(result.message, 'archive failed');
  assert.deepEqual(events, []);
});
