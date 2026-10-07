import assert from 'node:assert/strict';
import test from 'node:test';
import {
  calculateSessionWindows,
  canRecoverRotatedRefreshToken,
  createMobileRefreshToken,
  hashMobileRefreshToken,
  validateMobileDevice,
} from '../src/services/mobile-session.service.js';

test('mobile refresh tokens are high entropy and only their deterministic SHA-256 digest is persisted', () => {
  const first = createMobileRefreshToken();
  const second = createMobileRefreshToken();

  assert.notEqual(first, second);
  assert.match(first, /^[A-Za-z0-9_-]{43}$/);
  assert.match(hashMobileRefreshToken(first), /^[a-f0-9]{64}$/);
  assert.equal(hashMobileRefreshToken(first), hashMobileRefreshToken(first));
});

test('mobile login accepts bounded device metadata and rejects invalid installation identifiers', () => {
  assert.deepEqual(validateMobileDevice({
    deviceId: '3a7c0d2b-f9f2-4b64-a87e-453d4a24c5fe',
    deviceName: 'Xiaomi 15',
    appVersion: '0.1.0',
  }), {
    deviceId: '3a7c0d2b-f9f2-4b64-a87e-453d4a24c5fe',
    deviceName: 'Xiaomi 15',
    appVersion: '0.1.0',
  });

  assert.throws(() => validateMobileDevice({
    deviceId: 'not-a-device-id',
    deviceName: 'Xiaomi 15',
    appVersion: '0.1.0',
  }));
});

test('统一会话使用 90 天空闲窗口、365 天绝对窗口和 60 秒刷新宽限', () => {
  const now = new Date('2026-10-07T08:00:00.000Z');
  const createdAt = new Date('2026-10-01T08:00:00.000Z');
  const windows = calculateSessionWindows(now, createdAt);

  assert.equal(windows.expiresAt.toISOString(), '2027-01-05T08:00:00.000Z');
  assert.equal(windows.absoluteExpiresAt.toISOString(), '2027-10-01T08:00:00.000Z');
});

test('刷新宽限只允许未撤销会话在 60 秒内最多恢复 3 次', () => {
  const now = new Date('2026-10-07T08:00:00.000Z');
  const graceUntil = new Date('2026-10-07T08:01:00.000Z');

  assert.equal(canRecoverRotatedRefreshToken({
    revokedAt: null,
    rotationGraceUntil: graceUntil,
    rotationCount: 2,
  }, now), true);
  assert.equal(canRecoverRotatedRefreshToken({
    revokedAt: null,
    rotationGraceUntil: graceUntil,
    rotationCount: 3,
  }, now), false);
  assert.equal(canRecoverRotatedRefreshToken({
    revokedAt: null,
    rotationGraceUntil: graceUntil,
    rotationCount: 0,
  }, new Date('2026-10-07T08:01:00.001Z')), false);
  assert.equal(canRecoverRotatedRefreshToken({
    revokedAt: new Date('2026-10-07T07:59:00.000Z'),
    rotationGraceUntil: graceUntil,
    rotationCount: 0,
  }, now), false);
});
