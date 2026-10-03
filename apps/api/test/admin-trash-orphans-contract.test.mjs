import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('admin orphan trash API lists, adopts and purges with admin guard and audit', () => {
  const auth = read('../src/routes/auth.ts');

  assert.match(auth, /authRoutes\.get\('\/admin\/trash\/orphans', requireAdmin/);
  assert.match(auth, /authRoutes\.post\('\/admin\/trash\/:articleId\/adopt', requireAdmin/);
  assert.match(auth, /isNull\(articleMetadata\.id\)/);
  assert.match(auth, /sourceType: 'orphan_adopted'/);
  assert.match(auth, /action: 'orphan_adopted'/);
  assert.match(auth, /action: 'article_purged'/);
});
