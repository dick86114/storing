import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const authContext = readFileSync(new URL('../src/components/providers/AuthContext.tsx', import.meta.url), 'utf8');
const apiClient = readFileSync(new URL('../src/lib/api.ts', import.meta.url), 'utf8');

test('slow token verification does not log the user out', () => {
  assert.match(authContext, /setBootFailed\(!explicitUnauthenticated\)/);
  assert.match(apiClient, /timeoutMs: 10_000/);
  assert.doesNotMatch(authContext, /bootTimeout[\s\S]{0,220}localStorage\./);
  assert.doesNotMatch(authContext, /\.catch\(\(\) => \{\s*localStorage\./);
});

test('API client relies on same-origin HttpOnly cookies instead of browser-readable tokens', () => {
  assert.match(apiClient, /credentials: 'same-origin'/);
  assert.doesNotMatch(apiClient, /localStorage\.(getItem|setItem|removeItem)\('token'/);
  assert.doesNotMatch(apiClient, /Authorization: `Bearer/);
});

test('API responses are represented by ApiRequestError with status and server error code', async () => {
  const apiModule = await import('../src/lib/api.ts');
  const error = apiModule.parseApiErrorResponse(401, {
    error: { code: 'SESSION_EXPIRED', message: '登录已过期' },
  }, 'Request failed');

  assert.ok(error instanceof apiModule.ApiRequestError);
  assert.equal(error.status, 401);
  assert.equal(error.errorCode, 'SESSION_EXPIRED');
  assert.equal(error.message, '登录已过期');
});

test('server failures still use ApiRequestError without exposing response internals', async () => {
  const apiModule = await import('../src/lib/api.ts');
  const error = apiModule.parseApiErrorResponse(502, 'Bad Gateway', 'Request failed: 502');

  assert.ok(error instanceof apiModule.ApiRequestError);
  assert.equal(error.status, 502);
  assert.equal(error.errorCode, undefined);
  assert.equal(error.message, 'Request failed: 502');
});

test('network timeout keeps the browser AbortError semantics', async () => {
  const abortError = new DOMException('The operation was aborted.', 'AbortError');
  const originalFetch = globalThis.fetch;
  const originalWindow = globalThis.window;
  globalThis.window = {
    setTimeout: () => 0,
    clearTimeout: () => {},
  };
  globalThis.fetch = async () => {
    throw abortError;
  };

  try {
    const apiModule = await import('../src/lib/api.ts');
    await assert.rejects(
      apiModule.api.verifyToken(),
      (error) => error === abortError && error.name === 'AbortError',
    );
  } finally {
    globalThis.fetch = originalFetch;
    globalThis.window = originalWindow;
  }
});
