import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const workspaceRoot = new URL('../../../', import.meta.url);
const apiRoot = new URL('../', import.meta.url);
const read = (root, path) => readFileSync(new URL(path, root), 'utf8');

test('login delivers the JWT only in an HttpOnly cookie and the browser client does not persist tokens in localStorage', () => {
  const authRoute = read(apiRoot, 'src/routes/auth.ts');
  const apiClient = read(workspaceRoot, 'apps/web/src/lib/api.ts');
  const authContext = read(workspaceRoot, 'apps/web/src/components/providers/AuthContext.tsx');

  assert.match(authRoute, /setCookie\(c, 'storing_token'/);
  assert.match(authRoute, /httpOnly:\s*true/);
  assert.doesNotMatch(apiClient, /localStorage\.getItem\('token'\)/);
  assert.doesNotMatch(authContext, /localStorage\.setItem\('token'/);
});

test('cookie-authenticated state-changing API requests require an approved same-origin Origin header', () => {
  const middleware = read(apiRoot, 'src/middleware/auth.ts');
  const index = read(apiRoot, 'src/index.ts');

  assert.match(middleware, /export async function requireCsrfProtection/);
  assert.match(middleware, /Origin/);
  assert.match(index, /requireCsrfProtection/);
});

test('configured administrator startup does not silently re-enable or re-promote an existing account', () => {
  const bootstrap = read(apiRoot, 'src/services/admin-bootstrap.service.ts');
  const ensure = bootstrap.match(/export async function ensureConfiguredAdmin[\s\S]*?(?=export async function getConfiguredAdminStatus)/)?.[0];

  assert.ok(ensure, 'ensureConfiguredAdmin should exist');
  assert.doesNotMatch(ensure, /\.set\(\{ role: 'admin', status: 'active'/);
});

test('Docker deployment allows its public Origin and logout clears the same production cookie attributes', () => {
  const compose = read(workspaceRoot, 'docker-compose.yml');
  const authRoute = read(apiRoot, 'src/routes/auth.ts');
  const authContext = read(workspaceRoot, 'apps/web/src/components/providers/AuthContext.tsx');

  assert.match(compose, /APP_ORIGIN=\$\{APP_ORIGIN:-https:\/\/storing\.idickies\.com\}/);
  assert.match(authRoute, /deleteCookie\(c, 'storing_token', \{[\s\S]*?secure: process\.env\.NODE_ENV === 'production',[\s\S]*?sameSite: 'Lax',[\s\S]*?path: '\/'/);
  assert.match(authContext, /logout: \(\) => Promise<void>/);
  assert.match(authContext, /const logout = useCallback\(async \(\) => \{\s*await api\.logout\(\);\s*setUser\(null\);/);
});

test('same-origin browser writes remain valid behind a reverse proxy even when APP_ORIGIN was not injected into the container', () => {
  const middleware = read(apiRoot, 'src/middleware/auth.ts');

  assert.match(middleware, /const fetchSite = c\.req\.header\('Sec-Fetch-Site'\);/);
  assert.match(middleware, /fetchSite === 'same-origin'/);
  assert.match(middleware, /originAllowed \|\| extensionOriginAllowed \|\| sameOriginBrowserRequest/);
});
