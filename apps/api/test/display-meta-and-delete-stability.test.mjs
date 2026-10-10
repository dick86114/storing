import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const apiRoot = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, apiRoot), 'utf8');

test('internal WeChat imports do not repeatedly repair display metadata', () => {
  const reader = read('src/services/reader.service.ts');
  const routes = read('src/routes/articles.ts');

  assert.match(reader, /export function isInternalWeChatImportUrl/);
  assert.match(reader, /article\.title\s*&&\s*article\.source\s*&&\s*isInternalWeChatImportUrl\(article\.originalUrl\)/);
  assert.match(reader, /DISPLAY_META_RETRY_DELAY_MS/);
  assert.match(reader, /displayMetaRetryAt\.set\(articleId, now \+ DISPLAY_META_RETRY_DELAY_MS\)/);
  assert.match(reader, /cause\?\.code \? `\$\{message\} \(\$\{cause\.code\}\)` : message/);
  assert.match(routes, /isInternalWeChatImportUrl\(row\.originalUrl\)/);
  assert.match(routes, /isInternalWeChatImportUrl\(article\.originalUrl\)/);
});

test('permanent deletion is transactional and locks the shared article row', () => {
  const routes = read('src/routes/articles.ts');
  const permanent = routes.slice(routes.indexOf("'/articles/:id/permanent', requireAuth"));

  assert.match(permanent, /await db\.transaction\(async \(tx\) => \{/);
  assert.match(permanent, /\.for\('update'\)/);
  assert.match(permanent, /const \[\{ remaining \}\] = await tx/);
  assert.match(permanent, /await tx\.update\(collectJobs\)/);
  assert.match(permanent, /await tx\.update\(adminAuditLogs\)/);
  assert.match(permanent, /await tx\.delete\(articleMetadata\)/);
  assert.match(permanent, /await tx\.delete\(articles\)/);
});

test('foreign keys used by article deletion have dedicated indexes', () => {
  const indexes = read('src/services/db-indexes.service.ts');

  assert.match(indexes, /idx_collect_jobs_article ON collect_jobs \(article_id\)/);
  assert.match(indexes, /idx_article_metadata_article ON article_metadata \(article_id\)/);
  assert.match(indexes, /idx_ai_generation_jobs_article ON ai_generation_jobs \(article_id\)/);
});

test('macOS WeChat import reads batch files off the main actor', () => {
  const coordinator = read('../macos/QiankunjieMac/App/WeChatImportCoordinator.swift');

  const mainActorBatchLoop = coordinator.slice(
    coordinator.indexOf('func processPendingBatches'),
    coordinator.indexOf('nonisolated private func readImportFiles'),
  );
  const backgroundReader = coordinator.slice(
    coordinator.indexOf('nonisolated private func readImportFiles'),
  );

  assert.match(mainActorBatchLoop, /try await readImportFiles\(/);
  assert.doesNotMatch(mainActorBatchLoop, /Data\(contentsOf:/);
  assert.match(backgroundReader, /Data\(contentsOf: url\)/);
  assert.match(coordinator, /readImportFiles\(/);
  assert.match(coordinator, /nonisolated private func readImportFiles/);
});
