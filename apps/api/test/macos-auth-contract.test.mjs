import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const apiRoot = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, apiRoot), 'utf8');

test('macOS 认证使用可撤销的 macos 会话，并保持 Android 与扩展会话隔离', () => {
  const service = read('src/services/mobile-session.service.ts');
  const middleware = read('src/middleware/auth.ts');
  const route = read('src/routes/auth.ts');

  assert.match(service, /'android' \| 'browser_extension' \| 'macos'/);
  assert.match(middleware, /generateMacOSAccessToken/);
  for (const path of [
    '/macos/auth/login',
    '/macos/auth/refresh',
    '/macos/auth/logout',
    '/macos/auth/session',
    '/macos/auth/sessions',
  ]) {
    assert.match(route, new RegExp(path.replaceAll('/', '\\/')));
  }
  assert.match(route, /createMobileSession\(\{ userId: user\.id, device, clientType: 'macos' \}\)/);
  assert.match(route, /rotateMobileSession\(parsed\.data\.refresh_token, device, 'macos'\)/);
  assert.match(route, /revokeMobileSessionByRefreshToken\(parsed\.data\.refresh_token, 'macos'\)/);
  assert.match(route, /listMobileSessions\(user\.id, 'macos'\)/);
  assert.match(route, /revokeMobileSession\(id, user\.id, 'macos'\)/);
  assert.match(route, /revokeMobileSessionsForUser\(user\.id, 'macos'\)/);
});

test('macOS 访问令牌会校验 client、sessionId 和未撤销会话', () => {
  const middleware = read('src/middleware/auth.ts');
  const route = read('src/routes/auth.ts');

  assert.match(middleware, /payload\.client/);
  assert.match(middleware, /payload\.sessionId/);
  assert.match(middleware, /isNull\(mobileSessions\.revokedAt\)/);
  assert.match(middleware, /createClientSessionAuth\(/);
  assert.match(route, /requireMacOSAuth/);
  assert.match(route, /requireAndroidAuth/);
  assert.match(route, /requireExtensionAuth/);
  assert.match(
    route,
    /authRoutes\.get\('\/macos\/auth\/session', requireMacOSAuth/,
  );
  assert.match(route, /authRoutes\.get\('\/mobile\/auth\/sessions', requireAndroidAuth/);
  assert.match(route, /authRoutes\.get\('\/extension\/auth\/session', requireExtensionAuth/);
});
