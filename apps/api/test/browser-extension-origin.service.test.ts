import assert from 'node:assert/strict';
import test from 'node:test';
import { createAllowedCorsOrigins, isAllowedBrowserExtensionOrigin, resolveAllowedCorsOrigin } from '../src/services/browser-extension-origin.service.js';

test('allows only configured web and fixed browser-extension origins', () => {
  const allowed = createAllowedCorsOrigins({
    appOrigin: 'https://storing.example.com,http://localhost:1050',
    browserExtensionOrigins: 'chrome-extension://hpdboifbaofmnjmlajfjabplneololfl,https://not-an-extension.example',
  });

  assert.equal(resolveAllowedCorsOrigin('https://storing.example.com', allowed), 'https://storing.example.com');
  assert.equal(resolveAllowedCorsOrigin('chrome-extension://hpdboifbaofmnjmlajfjabplneololfl', allowed), 'chrome-extension://hpdboifbaofmnjmlajfjabplneololfl');
  assert.equal(resolveAllowedCorsOrigin('chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', allowed), undefined);
  assert.equal(resolveAllowedCorsOrigin('https://evil.example', allowed), undefined);
});


test('recognizes only configured fixed extension origins for CSRF exemption', () => {
  const configured = 'chrome-extension://hpdboifbaofmnjmlajfjabplneololfl';
  assert.equal(isAllowedBrowserExtensionOrigin('chrome-extension://hpdboifbaofmnjmlajfjabplneololfl', configured), true);
  assert.equal(isAllowedBrowserExtensionOrigin('chrome-extension://aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', configured), false);
  assert.equal(isAllowedBrowserExtensionOrigin('https://storing.example.com', configured), false);
});
