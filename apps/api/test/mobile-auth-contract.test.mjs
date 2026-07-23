import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const apiRoot = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, apiRoot), 'utf8');

test('mobile authentication uses a separately revocable session table and additive startup initializer', () => {
  const schema = read('src/db/schema.ts');
  const service = read('src/services/mobile-session.service.ts');
  const index = read('src/index.ts');

  assert.match(schema, /export const mobileSessions = pgTable\('mobile_sessions'/);
  assert.match(service, /CREATE TABLE IF NOT EXISTS mobile_sessions/);
  assert.match(service, /refresh_token_hash/);
  assert.match(service, /CREATE INDEX IF NOT EXISTS mobile_sessions_user_active_idx/);
  assert.match(index, /initMobileSessionSchema\(\)/);
});

test('mobile auth endpoints issue short access tokens, rotate refresh tokens, and do not alter cookie login', () => {
  const route = read('src/routes/auth.ts');
  const login = route.match(/authRoutes\.post\('\/login'[\s\S]*?(?=authRoutes\.)/)?.[0];

  assert.ok(login, 'browser login route should exist');
  assert.match(login, /setCookie\(c, 'storing_token'/);
  assert.doesNotMatch(login, /refresh_token/);

  for (const path of [
    '/mobile/auth/login',
    '/mobile/auth/refresh',
    '/mobile/auth/logout',
    '/mobile/auth/sessions',
  ]) {
    assert.match(route, new RegExp(`authRoutes\\.(post|get)\\('${path.replaceAll('/', '\\/')}`), `${path} should be implemented`);
  }

  assert.match(route, /generateMobileAccessToken\(/);
  assert.match(route, /rotateMobileSession\(/);
  assert.match(route, /revokeMobileSession\(/);
});

test('changing a password revokes active mobile refresh sessions', () => {
  const route = read('src/routes/auth.ts');
  const changePassword = route.match(/authRoutes\.post\('\/change-password'[\s\S]*?(?=authRoutes\.)/)?.[0];

  assert.ok(changePassword, 'change password route should exist');
  assert.match(changePassword, /revokeMobileSessionsForUser\(user\.id\)/);
});
