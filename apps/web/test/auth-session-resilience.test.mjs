import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const authContext = readFileSync(new URL('../src/components/providers/AuthContext.tsx', import.meta.url), 'utf8');
const apiClient = readFileSync(new URL('../src/lib/api.ts', import.meta.url), 'utf8');

test('slow token verification does not log the user out', () => {
  assert.match(authContext, /const bootTimeout = window\.setTimeout\(finishLoading, AUTH_BOOT_TIMEOUT_MS\);/);
  assert.doesNotMatch(authContext, /bootTimeout[\s\S]{0,220}localStorage\./);
  assert.doesNotMatch(authContext, /\.catch\(\(\) => \{\s*localStorage\./);
});

test('API client relies on same-origin HttpOnly cookies instead of browser-readable tokens', () => {
  assert.match(apiClient, /credentials: 'same-origin'/);
  assert.doesNotMatch(apiClient, /localStorage\.(getItem|setItem|removeItem)\('token'/);
  assert.doesNotMatch(apiClient, /Authorization: `Bearer/);
});
