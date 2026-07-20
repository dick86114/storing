import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const scopeService = readFileSync(new URL('../src/services/metadata-scope.service.ts', import.meta.url), 'utf8');
const apiIndex = readFileSync(new URL('../src/index.ts', import.meta.url), 'utf8');

test('startup repairs library metadata that an older deployment assigned to admin', () => {
  assert.match(scopeService, /export async function repairCollectedArticleMetadataOwnership\(\)/);
  assert.match(scopeService, /INSERT INTO article_metadata \(/);
  assert.match(scopeService, /FROM collect_jobs j/);
  assert.match(scopeService, /DELETE FROM article_metadata admin_meta/);
  assert.match(scopeService, /collect_metadata_owner_repair_v1/);
  assert.match(apiIndex, /await repairCollectedArticleMetadataOwnership\(\)/);
});
