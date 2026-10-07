import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatWebSessionCookie,
  parseWebSessionCookie,
} from '../src/services/web-session.service.js';

test('Web 会话 Cookie 使用会话 ID 加随机 secret 的两段格式', () => {
  const raw = formatWebSessionCookie(
    '018f3d6a-8e58-7d24-9f27-5b6d0b98b7f2',
    'A'.repeat(43),
  );

  assert.equal(raw, '018f3d6a-8e58-7d24-9f27-5b6d0b98b7f2.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA');
  assert.deepEqual(parseWebSessionCookie(raw), {
    sessionId: '018f3d6a-8e58-7d24-9f27-5b6d0b98b7f2',
    secret: 'A'.repeat(43),
  });
});

test('非法 Web 会话 Cookie 一律拒绝', () => {
  assert.equal(parseWebSessionCookie(undefined), null);
  assert.equal(parseWebSessionCookie(''), null);
  assert.equal(parseWebSessionCookie('only-one-part'), null);
  assert.equal(parseWebSessionCookie('not-a-uuid.secret'), null);
  assert.equal(parseWebSessionCookie('018f3d6a-8e58-7d24-9f27-5b6d0b98b7f2.short'), null);
  assert.equal(parseWebSessionCookie(`018f3d6a-8e58-7d24-9f27-5b6d0b98b7f2.${'A'.repeat(129)}`), null);
});
