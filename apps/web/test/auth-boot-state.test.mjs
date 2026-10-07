import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const webRoot = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, webRoot), 'utf8');
const authContext = read('src/components/providers/AuthContext.tsx');
const apiClient = read('src/lib/api.ts');
const layout = read('src/app/(main)/layout.tsx');
const page = read('src/app/page.tsx');
const desktopNav = read('src/components/layout/DesktopTopNav.tsx');
const mobileNav = read('src/components/layout/MobileTopNav.tsx');

test('认证启动状态只区分加载、已登录、未登录和启动失败', () => {
  for (const status of ['loading', 'authenticated', 'unauthenticated', 'bootFailed']) {
    assert.match(authContext, new RegExp(`status: '${status}'`));
  }
  assert.match(authContext, /bootFailed'; retry: \(\) => void/);
});

test('认证启动不再使用 3 秒兜底超时', () => {
  assert.doesNotMatch(authContext, /AUTH_BOOT_TIMEOUT_MS|window\.setTimeout/);
  assert.doesNotMatch(authContext, /window\.setTimeout\(finishLoading/);
  assert.match(apiClient, /timeoutMs: 10_000|timeoutMs: 10000/);
});

test('明确认证响应才进入未登录，网络或服务异常进入可重试失败态', () => {
  assert.match(authContext, /error instanceof ApiRequestError/);
  assert.match(authContext, /error\.status === 401 \|\| error\.status === 403/);
  assert.match(authContext, /status: 'bootFailed', retry/);
  assert.match(authContext, /retryBoot/);
});

test('私有路由只在明确未登录时重定向', () => {
  assert.match(layout, /bootState\.status === 'unauthenticated'/);
  assert.doesNotMatch(layout, /!isAuthenticated && !isLoading/);
  assert.match(layout, /网络暂时不可用，请重试/);
  assert.match(layout, /retryBoot/);
});

test('迁移期根路由同时识别新旧会话 Cookie', () => {
  assert.match(page, /storing_token/);
  assert.match(page, /storing_session/);
});

test('顶栏启动失败显示重试而不是登录成功态', () => {
  for (const source of [desktopNav, mobileNav]) {
    assert.match(source, /bootState\.status === 'bootFailed'/);
    assert.match(source, /网络暂时不可用/);
    assert.match(source, /retryBoot/);
  }
});
