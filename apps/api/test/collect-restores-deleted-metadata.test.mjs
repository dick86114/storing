import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const collect = readFileSync(new URL('../src/services/collect.service.ts', import.meta.url), 'utf8');

test('重新采集已删除文章时恢复当前用户元数据的可见状态', () => {
  const metadataValues = collect.match(/const metadataValues:[\s\S]*?\n  \};/);
  const metadataUpdate = collect.match(/if \(meta\) \{[\s\S]*?\n  \} else \{/);

  assert.ok(metadataValues, '采集元数据值应存在');
  assert.match(metadataValues[0], /isDeleted: false/);
  assert.ok(metadataUpdate, '已存在元数据的更新分支应存在');
  assert.match(metadataUpdate[0], /set\(metadataValues\)/);
});
