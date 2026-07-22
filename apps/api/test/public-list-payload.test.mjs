import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const routes = readFileSync(new URL('../src/routes/articles.ts', import.meta.url), 'utf8');

test('public article list does not select or return full article bodies for card rendering', () => {
  const start = routes.indexOf("if (view === 'published') {");
  const end = routes.indexOf("if (!isAuthenticated(c))", start);
  const implementation = routes.slice(start, end);

  assert.ok(implementation, 'public published-list branch should exist');
  assert.doesNotMatch(implementation, /contentMd:\s*articleMetadata\.contentMd/);
  assert.doesNotMatch(implementation, /contentHtml:\s*articleMetadata\.contentHtml/);
  assert.match(implementation, /serializePublicPublication\(article, \{ includeContent: false \}\)/);
});

test('public detail keeps its independently selected and sanitized body content', () => {
  assert.match(routes, /contentHtml:\s*articleMetadata\.contentHtml/);
  assert.match(routes, /sanitizeCapturedHtml\(article\.contentHtml \|\| ''\)/);
});
