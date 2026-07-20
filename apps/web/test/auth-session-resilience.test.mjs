import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const authContext = readFileSync(new URL('../src/components/providers/AuthContext.tsx', import.meta.url), 'utf8');
const apiClient = readFileSync(new URL('../src/lib/api.ts', import.meta.url), 'utf8');

test('slow token verification does not log the user out', () => {
  assert.match(authContext, /const bootTimeout = window\.setTimeout\(finishLoading, AUTH_BOOT_TIMEOUT_MS\);/);
  assert.doesNotMatch(authContext, /bootTimeout[\s\S]{0,220}localStorage\.removeItem\('token'\)/);
  assert.doesNotMatch(authContext, /\.catch\(\(\) => \{\s*localStorage\.removeItem\('token'\);/);
});

test('only an unauthenticated response clears the saved token', () => {
  assert.match(apiClient, /if \(res\.status === 401\) \{\s*localStorage\.removeItem\('token'\);/);
  assert.doesNotMatch(apiClient, /res\.status === 401 \|\| res\.status === 403/);
});
