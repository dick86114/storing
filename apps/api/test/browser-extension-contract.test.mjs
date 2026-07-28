import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const apiRoot = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, apiRoot), 'utf8');

test('browser extension authentication has a separately typed revocable client session', () => {
  const schema = read('src/db/schema.ts');
  const sessions = read('src/services/mobile-session.service.ts');
  const auth = read('src/routes/auth.ts');
  const middleware = read('src/middleware/auth.ts');

  assert.match(schema, /clientType: text\('client_type'\).*default\('android'\)/);
  assert.match(sessions, /type ClientSessionType = 'android' \| 'browser_extension'/);
  assert.match(sessions, /client_type TEXT NOT NULL DEFAULT 'android'/);
  assert.match(auth, /authRoutes\.post\('\/extension\/auth\/login'/);
  assert.match(auth, /authRoutes\.post\('\/extension\/auth\/refresh'/);
  assert.match(auth, /authRoutes\.post\('\/extension\/auth\/logout'/);
  assert.match(auth, /authRoutes\.get\('\/extension\/auth\/session'/);
  assert.match(middleware, /generateClientAccessToken\(/);
  assert.match(auth, /'browser_extension'/);
});

test('browser extension collection has a dedicated source while using the first-party worker', () => {
  const collectRoutes = read('src/routes/collect.ts');
  const collectService = read('src/services/collect.service.ts');

  assert.match(collectRoutes, /collectRoutes\.post\('\/extension\/collect'/);
  assert.match(collectRoutes, /requestSource: 'browser_extension'/);
  assert.match(collectRoutes, /saveToInbox: true/);
  assert.match(collectService, /'browser_extension'/);
  assert.match(collectService, /FIRST_PARTY_COLLECT_SOURCES/);
  assert.match(collectService, /\['web', 'android', 'android_share', 'browser_extension'\]/);
});

test('only configured extension origins receive cross-origin API access', () => {
  const index = read('src/index.ts');
  const origins = read('src/services/browser-extension-origin.service.ts');

  assert.match(index, /BROWSER_EXTENSION_ALLOWED_ORIGINS/);
  assert.match(index, /resolveAllowedCorsOrigin/);
  assert.match(origins, /chrome-extension/);
  assert.match(index, /Authorization/);
  assert.match(index, /allowedCorsOrigins/);
});
