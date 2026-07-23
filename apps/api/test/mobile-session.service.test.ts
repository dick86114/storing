import assert from 'node:assert/strict';
import test from 'node:test';
import {
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
