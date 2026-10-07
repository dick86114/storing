import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const apiRoot = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, apiRoot), 'utf8');
const service = read('src/services/mobile-session.service.ts');
const middleware = read('src/middleware/auth.ts');
const route = read('src/routes/auth.ts');
const telemetry = read('src/services/auth-telemetry.service.ts');

test('macOS 认证使用可撤销的 macos 会话，并保持 Android 与扩展会话隔离', () => {
  assert.match(service, /'android' \| 'browser_extension' \| 'macos' \| 'web'/);
  assert.match(middleware, /generateMacOSAccessToken/);
  for (const path of [
    '/macos/auth/login',
    '/macos/auth/refresh',
    '/macos/auth/migrate-legacy',
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

test('旧 Android Mac 会话迁移为 macOS 会话并保留轮换宽限', () => {
  assert.match(service, /export async function migrateLegacyMacSession/);
  assert.match(service, /eq\(mobileSessions\.clientType, 'android'\)/);
  assert.match(service, /clientType: 'macos' as const/);
  assert.match(service, /macos_legacy_session_migrated/);
  assert.match(service, /previous_refresh_token_hash/);
  assert.match(service, /rotation_grace_until/);
});

test('macOS 会话轮换与恢复使用事务和认证遥测', () => {
  assert.match(service, /db\.transaction\(async \(tx\)/);
  assert.match(service, /previous_refresh_token_hash/);
  assert.match(service, /rotation_grace_until/);
  for (const field of ['userId', 'sessionId', 'clientType', 'event', 'errorCode', 'durationMs']) {
    assert.match(telemetry, new RegExp(field));
  }
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
