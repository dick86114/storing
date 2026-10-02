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
