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

test('startup cleanup preserves a saved MCP article when the same owner also used summarize_url', () => {
  const cleanup = scopeService.match(/DELETE FROM article_metadata m[\s\S]*?await db\.execute\(sql\.raw\(`ALTER TABLE article_metadata ALTER COLUMN user_id SET NOT NULL`\)\)/)?.[0];
  assert.ok(cleanup, 'summarize-only metadata cleanup should be present');
  assert.match(cleanup, /AND NOT EXISTS \([\s\S]*?j\.request_source = 'mcp'\s+AND j\.save_to_inbox = true\s+AND j\.user_id = m\.user_id[\s\S]*?\)/);
});

test('startup restores only legacy MCP saves that lost their user metadata during the faulty cleanup', () => {
  assert.match(scopeService, /export async function repairMissingMcpSavedArticleMetadata\(\)/);
  assert.match(scopeService, /mcp_saved_metadata_repair_v1/);
  assert.match(scopeService, /j\.request_source = 'mcp'\s+AND j\.save_to_inbox = TRUE/);
  assert.match(scopeService, /ON CONFLICT \(user_id, article_id\) DO NOTHING/);
  assert.match(apiIndex, /await repairMissingMcpSavedArticleMetadata\(\)/);
});
