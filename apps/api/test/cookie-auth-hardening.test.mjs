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
