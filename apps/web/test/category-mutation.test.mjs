import assert from 'node:assert/strict';
import { test } from 'node:test';

import categoryMutationModule from '../src/lib/category-mutation.ts';

const {
  createCategoryMutationGate,
  runCommittedCategoryMutation,
  snapshotCategoryActionSource,
} = categoryMutationModule;

test('统一 mutation 锁覆盖保存、优化、排序、启停、合并、删除和创建', () => {
  const kinds = ['save', 'optimize', 'reorder', 'activate', 'deactivate', 'merge', 'delete', 'create'];
  for (const kind of kinds) {
    const gate = createCategoryMutationGate();
    assert.equal(gate.tryAcquire(kind), true);
    assert.equal(gate.tryAcquire('save'), false);
    assert.equal(gate.active, kind);
    gate.release(kind);
    assert.equal(gate.active, null);
  }
});

test('提交成功后的 catalog refresh 失败仍返回成功并只产生刷新警告', async () => {
  const events = [];
  const result = await runCommittedCategoryMutation({
    commit: async () => ({ id: 9 }),
    refresh: async () => { throw new Error('catalog offline'); },
    onCommitted: (value) => events.push(['committed', value.id]),
    onFailure: () => events.push(['failure']),
    onRefreshWarning: (error) => events.push(['warning', error.message]),
  });

  assert.equal(result.status, 'success');
  assert.deepEqual(events, [['committed', 9], ['warning', 'catalog offline']]);
});

test('提交失败不会执行成功回调或刷新', async () => {
  const events = [];
  const result = await runCommittedCategoryMutation({
    commit: async () => { throw new Error('write failed'); },
    refresh: async () => events.push(['refresh']),
    onCommitted: () => events.push(['committed']),
    onFailure: (error) => events.push(['failure', error.message]),
    onRefreshWarning: () => events.push(['warning']),
  });

  assert.equal(result.status, 'failure');
  assert.deepEqual(events, [['failure', 'write failed']]);
});

test('操作弹窗打开后固定 actionSource，不受后续目录对象变化影响', () => {
  const selected = { id: 2, name: '工作' };
  const actionSource = snapshotCategoryActionSource(selected);
  selected.name = '工作（新）';
  assert.equal(actionSource.id, 2);
  assert.equal(actionSource.name, '工作');
});
