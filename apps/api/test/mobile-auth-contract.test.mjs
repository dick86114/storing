import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const apiRoot = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, apiRoot), 'utf8');
const route = read('src/routes/auth.ts');
const telemetry = read('src/services/auth-telemetry.service.ts');

test('mobile authentication uses a separately revocable session table and additive startup initializer', () => {
  const schema = read('src/db/schema.ts');
  const service = read('src/services/mobile-session.service.ts');
  const index = read('src/index.ts');

  assert.match(schema, /export const mobileSessions = pgTable\('mobile_sessions'/);
  assert.match(service, /type ClientSessionType = 'android' \| 'browser_extension' \| 'macos'/);
  assert.match(service, /CREATE TABLE IF NOT EXISTS mobile_sessions/);
  assert.match(service, /refresh_token_hash/);
  assert.match(service, /CREATE INDEX IF NOT EXISTS mobile_sessions_user_active_idx/);
  assert.match(index, /initMobileSessionSchema\(\)/);
});

test('mobile auth endpoints issue short access tokens and rotate refresh tokens while Web login uses a database session', () => {
  const route = read('src/routes/auth.ts');
  const login = route.match(/authRoutes\.post\('\/login'[\s\S]*?(?=authRoutes\.)/)?.[0];

  assert.ok(login, 'browser login route should exist');
  assert.match(login, /writeWebSessionCookie\(c, session\.session\.id, session\.cookieSecret\)/);
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
  assert.match(changePassword, /revokeMobileSessionsForUser\(user\.id, 'android'\)/);
  assert.match(changePassword, /revokeMobileSessionsForUser\(user\.id, 'browser_extension'\)/);
  assert.match(changePassword, /revokeMobileSessionsForUser\(user\.id, 'macos'\)/);
});

test('mobile refresh does not revoke inactive sessions as browser-extension sessions', () => {
  const refresh = route.match(/authRoutes\.post\('\/mobile\/auth\/refresh'[\s\S]*?(?=authRoutes\.)/)?.[0];

  assert.ok(refresh, 'mobile refresh route should exist');
  assert.match(refresh, /handleInactiveRefreshUser\(c, rotated\.userId, 'android'\)/);
  assert.doesNotMatch(refresh, /handleInactiveRefreshUser\(c, rotated\.userId, 'browser_extension'\)/);
});

test('认证遥测只输出安全字段且不记录凭据', () => {
  for (const field of ['userId', 'sessionId', 'clientType', 'event', 'errorCode', 'durationMs']) {
    assert.match(telemetry, new RegExp(field));
  }
  assert.doesNotMatch(telemetry, /refreshToken|accessToken|cookie|authorization|password/i);
  assert.doesNotMatch(telemetry, /console\.log/);
});
