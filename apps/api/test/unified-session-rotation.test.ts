import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const apiRoot = new URL('../', import.meta.url);
const schema = readFileSync(new URL('src/db/schema.ts', apiRoot), 'utf8');
const service = readFileSync(new URL('src/services/mobile-session.service.ts', apiRoot), 'utf8');

test('通用会话表保存轮换宽限、绝对过期和 Web 客户端类型', () => {
  for (const field of [
    'previous_refresh_token_hash',
    'rotation_grace_until',
    'rotation_count',
    'absolute_expires_at',
  ]) {
    assert.match(schema, new RegExp(field));
    assert.match(service, new RegExp(field));
  }
  assert.match(service, /'android' \| 'browser_extension' \| 'macos' \| 'web'/);
});

test('存量会话先回填绝对过期，再收紧为非空列', () => {
  const addColumn = service.indexOf('ADD COLUMN IF NOT EXISTS absolute_expires_at TIMESTAMP');
  const backfill = service.indexOf('UPDATE mobile_sessions SET absolute_expires_at =');
  const setNotNull = service.indexOf('ALTER COLUMN absolute_expires_at SET NOT NULL');

  assert.notEqual(addColumn, -1);
  assert.notEqual(backfill, -1);
  assert.notEqual(setNotNull, -1);
  assert.ok(addColumn < backfill);
  assert.ok(backfill < setNotNull);
});

test('旧刷新令牌哈希建立唯一索引', () => {
  assert.match(service, /CREATE UNIQUE INDEX IF NOT EXISTS mobile_sessions_previous_refresh_token_hash_idx/);
});
