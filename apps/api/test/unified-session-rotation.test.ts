import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  buildMobileSessionRotation,
  canRecoverRotatedRefreshToken,
} from '../src/services/mobile-session.service.js';

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

test('正常轮换保存旧令牌哈希并重置宽限恢复计数', () => {
  const now = new Date('2026-10-07T08:00:00.000Z');
  const rotation = buildMobileSessionRotation({
    session: {
      createdAt: new Date('2026-10-01T08:00:00.000Z'),
      absoluteExpiresAt: new Date('2027-10-01T08:00:00.000Z'),
      rotationCount: 2,
    },
    presentedTokenHash: 'current-hash',
    nextTokenHash: 'next-hash',
    now,
    recovery: false,
  });

  assert.equal(rotation.recoveredByRotationGrace, false);
  assert.equal(rotation.values.previousRefreshTokenHash, 'current-hash');
  assert.equal(rotation.values.rotationCount, 0);
  assert.equal(rotation.values.rotationGraceUntil?.toISOString(), '2026-10-07T08:01:00.000Z');
});

test('宽限恢复递增次数且空闲续期不越过绝对过期', () => {
  const now = new Date('2026-10-07T08:00:00.000Z');
  const rotation = buildMobileSessionRotation({
    session: {
      createdAt: new Date('2025-10-06T08:00:00.000Z'),
      absoluteExpiresAt: new Date('2026-10-06T08:00:00.000Z'),
      rotationCount: 1,
    },
    presentedTokenHash: 'previous-hash',
    nextTokenHash: 'next-hash',
    now,
    recovery: true,
  });

  assert.equal(rotation.recoveredByRotationGrace, true);
  assert.equal(rotation.values.previousRefreshTokenHash, 'previous-hash');
  assert.equal(rotation.values.rotationCount, 2);
  assert.equal(rotation.values.expiresAt?.toISOString(), '2026-10-06T08:00:00.000Z');
});

test('轮换更新和宽限查询都在数据库事务内执行', () => {
  assert.match(service, /db\.transaction\(async \(tx\)/);
  assert.match(service, /tx\s*\n\s*\.select\(\)/);
  assert.match(service, /tx\s*\n\s*\.update\(mobileSessions\)/);
});
