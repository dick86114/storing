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
  assert.match(scopeService, /collect_metadata_owner_repair_v2/);
  assert.match(apiIndex, /await repairCollectedArticleMetadataOwnership\(\)/);
});

test('启动补偿不会把其他用户的采集文章补进管理员资料库', () => {
  const legacyBackfill = scopeService.match(/INSERT INTO article_metadata \(article_id, user_id, source_type, is_favorited, is_archived, created_at, updated_at\)[\s\S]*?ON CONFLICT DO NOTHING/);

  assert.ok(legacyBackfill, '旧单用户元数据补偿应存在');
  assert.match(legacyBackfill[0], /AND NOT EXISTS \([\s\S]*?j\.user_id IS NOT NULL[\s\S]*?j\.user_id <> \$\{adminUserId\}[\s\S]*?j\.save_to_inbox = true[\s\S]*?\)/);
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
