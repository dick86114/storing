import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const apiRoot = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, apiRoot), 'utf8');
const middleware = read('src/middleware/auth.ts');
const route = read('src/routes/auth.ts');

test('缺少访问凭据返回 401 和 UNAUTHORIZED', () => {
  assert.match(middleware, /code: 'UNAUTHORIZED', message: '请先登录'/);
  assert.match(middleware, /\}, 401\);\n  }\n\n  const userId = verifyToken\(token\)/);
});

test('无效或过期 access token 返回 401 和 INVALID_TOKEN', () => {
  const occurrences = middleware.match(/code: 'INVALID_TOKEN', message: 'Token 无效或已过期'/g) || [];
  assert.ok(occurrences.length >= 4);
});

test('客户端会话过期与撤销使用不同错误码', () => {
  assert.match(middleware, /code: 'SESSION_EXPIRED', message: '登录会话已过期，请重新登录'/);
  assert.match(middleware, /code: 'SESSION_REVOKED', message: '登录会话已撤销，请重新登录'/);
  assert.match(middleware, /code: 'SESSION_EXPIRED'[\s\S]{0,140}401\)/);
  assert.match(middleware, /code: 'SESSION_REVOKED'[\s\S]{0,140}401\)/);
  assert.match(middleware, /getSessionFailureReason/);
});

test('可选认证接口收到过期或无效客户端令牌必须返回 401', () => {
  const optionalAuth = middleware.slice(
    middleware.indexOf('export async function optionalAuth'),
    middleware.indexOf('export async function requireAdmin'),
  );

  // 客户端只在 401 时刷新令牌；把过期令牌当游客放行会让私有接口误报 403。
  assert.match(optionalAuth, /hasBearerAuthorization/);
  assert.match(optionalAuth, /token && hasBearerAuthorization/);
  assert.match(optionalAuth, /clientSessionErrorResponse\(c, clientSessionState\)/);
  assert.match(optionalAuth, /await getSessionFailureReason\(clientPayload\)/);
  assert.match(optionalAuth, /Token 无效或已过期[\s\S]{0,80}401\)/);
});

test('刷新令牌保留旧客户端依赖的 INVALID_REFRESH_TOKEN', () => {
  assert.match(route, /code: 'INVALID_REFRESH_TOKEN', message: '登录已失效，请重新登录'/);
  assert.match(route, /\}, 401\)/);
});

test('禁用账号返回 403 和 USER_DISABLED', () => {
  assert.match(route, /code: 'USER_DISABLED', message: '用户已禁用'/);
  assert.match(middleware, /code: 'USER_DISABLED', message: '用户已禁用'/);
  assert.match(middleware, /\}, 403\)/);
});

test('登录限流返回 429 和 LOGIN_RATE_LIMITED', () => {
  assert.match(route, /code: 'LOGIN_RATE_LIMITED', message: '登录尝试过于频繁，请稍后再试'/);
  assert.match(route, /\}, 429\)/);
});
