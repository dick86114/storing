import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../../../apps/mcp/src/http.ts', import.meta.url), 'utf8');

test('MCP does not grant wildcard browser CORS when no explicit browser origin allowlist exists', () => {
  assert.doesNotMatch(source, /return origin \|\| '\*';/);
  assert.match(source, /if \(!origin\) return '';/);
  assert.match(source, /allowedOrigins\.includes\(origin\)/);
});
