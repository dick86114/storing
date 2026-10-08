import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/services/collect.service.ts', import.meta.url), 'utf8');

test('Android and shared Android collection jobs save to the inbox rather than auto-archiving', () => {
  assert.doesNotMatch(source, /function shouldArchiveCollectedArticle/);
  assert.doesNotMatch(source, /markArchived:\s*(?:true|shouldArchiveCollectedArticle)/);
  assert.match(source, /markArchived:\s*false/);
});
