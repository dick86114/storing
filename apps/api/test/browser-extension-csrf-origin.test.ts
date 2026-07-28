import assert from 'node:assert/strict';
import test from 'node:test';
import { Hono } from 'hono';
import { requireCsrfProtection } from '../src/middleware/auth.js';

const extensionOrigin = 'chrome-extension://hpdboifbaofmnjmlajfjabplneololfl';

async function request(origin: string) {
  const app = new Hono();
  app.use('*', requireCsrfProtection);
  app.post('/write', (context) => context.text('ok'));
  return app.request('http://api.example.test/write', {
    method: 'POST',
    headers: { Origin: origin, Cookie: 'storing_token=web-cookie' },
  });
}

test('configured official extension origin may make cookie-bearing writes while unconfigured origins remain blocked', async () => {
  const originalAppOrigin = process.env.APP_ORIGIN;
  const originalExtensionOrigins = process.env.BROWSER_EXTENSION_ALLOWED_ORIGINS;
  process.env.APP_ORIGIN = 'https://storing.example.com';
  process.env.BROWSER_EXTENSION_ALLOWED_ORIGINS = extensionOrigin;
  try {
    assert.equal((await request(extensionOrigin)).status, 200);
    assert.equal((await request('chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')).status, 403);
    assert.equal((await request('https://evil.example')).status, 403);
  } finally {
    process.env.APP_ORIGIN = originalAppOrigin;
    process.env.BROWSER_EXTENSION_ALLOWED_ORIGINS = originalExtensionOrigins;
  }
});
