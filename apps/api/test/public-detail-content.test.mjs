import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const routes = readFileSync(new URL('../src/routes/articles.ts', import.meta.url), 'utf8');

test('public detail includes sanitized article content unless a caller explicitly requests list mode', () => {
  assert.match(routes, /if \(options\.includeContent === false\) return serialized;/);
  assert.match(routes, /serializePublicPublication\(publication\)/);
});
