import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const apiRoot = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, apiRoot), 'utf8');

test('admin trash API lists, restores and purges soft-deleted articles with admin guard and audit', () => {
  const auth = read('src/routes/auth.ts');

  for (const path of ['/admin/trash', '/admin/trash/:articleId/restore', '/admin/trash/:articleId']) {
    assert.match(auth, new RegExp(path.replaceAll('/', '\\/')));
  }
  assert.match(auth, /authRoutes\.get\('\/admin\/trash', requireAdmin/);
  assert.match(auth, /authRoutes\.post\('\/admin\/trash\/:articleId\/restore', requireAdmin/);
  assert.match(auth, /authRoutes\.delete\('\/admin\/trash\/:articleId', requireAdmin/);
  assert.match(auth, /action: 'article_restored'/);
  assert.match(auth, /action: 'article_purged'/);

  // 恢复只清删除标记；彻底删除必须连元数据与原始文章一起清除。
  assert.match(auth, /set\(\{ isDeleted: false, updatedAt: new Date\(\) \}\)/);
  const purge = auth.slice(auth.indexOf("'/admin/trash/:articleId', requireAdmin"));
  assert.match(purge, /delete\(articleMetadata\)\.where\(eq\(articleMetadata\.articleId, articleId\)\)/);
  assert.match(purge, /delete\(articles\)\.where\(eq\(articles\.id, articleId\)\)/);
});

test('admin trash API exposes independent bulk clear endpoints with per-item outcomes', () => {
  const auth = read('src/routes/auth.ts');
  const service = read('src/services/admin-trash.service.ts');

  assert.ok(auth.includes("import { clearAdminTrash, clearAdminTrashOrphans } from '../services/admin-trash.service.js'"));
  assert.match(auth, /authRoutes\.delete\('\/admin\/trash', requireAdmin/);
  assert.match(auth, /clearAdminTrash\(getCurrentUser\(c\)\.id\)/);
  assert.match(auth, /clearAdminTrashOrphans\(getCurrentUser\(c\)\.id\)/);

  // Hono 按注册顺序匹配同类动态路由；批量孤儿端点必须先于 /:articleId 注册。
  const orphanBulkIndex = auth.indexOf("'/admin/trash/orphans', requireAdmin");
  const singlePurgeIndex = auth.indexOf("'/admin/trash/:articleId', requireAdmin");
  assert.ok(orphanBulkIndex >= 0);
  assert.ok(singlePurgeIndex >= 0);
  assert.ok(orphanBulkIndex < singlePurgeIndex);

  assert.match(service, /interface AdminTrashBulkFailure/);
  assert.match(service, /articleId: number/);
  assert.match(service, /userId\?: number \| null/);
  assert.match(service, /reason: string/);
  assert.match(service, /interface AdminTrashBulkResult/);
  assert.match(service, /attempted: number/);
  assert.match(service, /succeeded: number/);
  assert.match(service, /failed: number/);
  assert.match(service, /deletedMetadata: number/);
  assert.match(service, /deletedArticles: number/);
  assert.match(service, /failures: AdminTrashBulkFailure\[\]/);
});

test('bulk deleted-trash clearing preserves active user metadata and reports partial failures', () => {
  const service = read('src/services/admin-trash.service.ts');

  assert.ok(service.includes('const activeMetadata = await tx'));
  assert.match(service, /eq\(articleMetadata\.isDeleted, false\)/);
  assert.match(service, /activeMetadata\.length === 0/);
  assert.match(service, /db\.transaction\(async \(tx\) =>/);
  assert.match(service, /文章状态已变化，请刷新后重试/);
  assert.match(service, /error instanceof Error \? error\.message : String\(error\)/);
  assert.match(service, /'article_trash_emptied' \| 'orphan_trash_emptied'/);
  assert.match(service, /action,/);
});
