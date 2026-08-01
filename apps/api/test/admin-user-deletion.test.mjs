import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('管理员删除用户接口受管理员权限与账号保护约束', () => {
  const routes = read('src/routes/auth.ts');

  assert.match(routes, /authRoutes\.delete\('\/admin\/users\/:id', requireAdmin/);
  assert.match(routes, /SELF_DELETE_FORBIDDEN/);
  assert.match(routes, /ADMIN_DELETE_FORBIDDEN/);
  assert.match(routes, /USER_NOT_FOUND/);
});

test('管理员删除用户在事务内清理私有数据并保留共享文章', () => {
  const routes = read('src/routes/auth.ts');

  assert.match(routes, /await db\.transaction\(async \(tx\) =>/);
  assert.match(routes, /tx\.delete\(articleMetadata\)\.where\(eq\(articleMetadata\.userId, id\)\)/);
  assert.match(routes, /tx\.delete\(collectJobs\)\.where\(eq\(collectJobs\.userId, id\)\)/);
  assert.match(routes, /tx\.delete\(mobileSessions\)\.where\(eq\(mobileSessions\.userId, id\)\)/);
  assert.match(routes, /tx\.delete\(users\)\.where\(eq\(users\.id, id\)\)/);
  assert.doesNotMatch(routes, /tx\.delete\(articles\)/);
});
