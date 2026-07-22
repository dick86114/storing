import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const apiRoot = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, apiRoot), 'utf8');

test('captured HTML is sanitized before it can be returned by an article endpoint', () => {
  const singleFile = read('src/services/singlefile.service.ts');
  const articles = read('src/routes/articles.ts');

  assert.match(singleFile, /export function sanitizeCapturedHtml\(/);
  assert.match(articles, /sanitizeCapturedHtml\(article\.contentHtml \|\| ''\)/);
});

test('personal article actions cannot create ownership metadata for arbitrary global article ids', () => {
  const routes = read('src/routes/articles.ts');

  assert.doesNotMatch(routes, /async function ensureMetadata\(/);
  for (const action of ['favorite', 'archive', 'unarchive', 'refetch', 'regenerate-ai']) {
    const implementation = routes.match(new RegExp(`articlesRoutes\\.post\\('/articles/:id/${action}'[\\s\\S]*?(?=articlesRoutes\\.|$)`))?.[0];
    assert.ok(implementation, `${action} route should exist`);
    assert.match(implementation, /getArticleRecord\(id, userId\)/, `${action} must verify current-user ownership`);
  }
});


test('article deletion endpoints require current-user ownership before changing metadata or originals', () => {
  const routes = read('src/routes/articles.ts');
  for (const path of ['/articles/:id', '/articles/:id/permanent']) {
    const start = routes.indexOf(`articlesRoutes.delete('${path}'`);
    const end = routes.indexOf('articlesRoutes.', start + 1);
    const implementation = start >= 0 ? routes.slice(start, end >= 0 ? end : undefined) : '';
    assert.ok(implementation, `${path} route should exist`);
    assert.match(implementation, /getArticleRecord\(id, userId\)/, `${path} must verify current-user ownership`);
  }
});

test('production authentication has no known default secret or administrator password', () => {
  const auth = read('src/middleware/auth.ts');
  const bootstrap = read('src/services/admin-bootstrap.service.ts');

  assert.doesNotMatch(auth, /storing-jwt-secret-key/);
  assert.doesNotMatch(bootstrap, /\|\| 'admin123'/);
  assert.match(auth, /getRequiredJwtSecret|JWT_SECRET/);
  assert.match(bootstrap, /requireConfiguredAdminCredentials|ADMIN_PASSWORD/);
});

test('login route applies a login-specific rate-limit gate before password verification', () => {
  const route = read('src/routes/auth.ts');
  const login = route.match(/authRoutes\.post\('\/login'[\s\S]*?(?=authRoutes\.)/)?.[0];

  assert.ok(login, 'login route should exist');
  assert.match(login, /checkLoginRateLimit\(/);
  assert.match(login, /recordLoginFailure\(/);
  assert.match(login, /clearLoginFailures\(/);
});
