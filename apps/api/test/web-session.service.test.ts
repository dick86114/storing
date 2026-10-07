import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatWebSessionCookie,
  parseWebSessionCookie,
  createWebSession,
} from '../src/services/web-session.service.js';
import { hashMobileRefreshToken } from '../src/services/mobile-session.service.js';
import { db } from '../src/db/index.js';
import { users, mobileSessions } from '../src/db/schema.js';
import { eq } from 'drizzle-orm';

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

test('登录创建的 Web 会话保存的是 Cookie secret 哈希', async () => {
  const [user] = await db.insert(users).values({
    username: `web-session-test-${Date.now()}`,
    passwordHash: 'test-only-hash',
    role: 'user',
    status: 'active',
  }).returning();

  try {
    const created = await createWebSession(user.id);
    const [session] = await db.select().from(mobileSessions).where(eq(mobileSessions.id, created.session.id));

    assert.equal(session.refreshTokenHash, hashMobileRefreshToken(created.cookieSecret));
  } finally {
    await db.delete(users).where(eq(users.id, user.id));
  }
});
