import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const readWorkspace = (path) => readFileSync(new URL(`../../${path.replace('apps/', '')}`, import.meta.url), 'utf8');

test('admin article management is isolated behind dedicated admin routes and keeps the target owner explicit', () => {
  const routes = read('src/routes/auth.ts');

  assert.match(routes, /authRoutes\.get\('\/admin\/users\/:id\/articles', requireAdmin/);
  assert.match(routes, /eq\(articleMetadata\.userId, targetUserId\)/);
  assert.match(routes, /authRoutes\.post\('\/admin\/users\/:id\/articles\/:articleId\/copy-to-me', requireAdmin/);
  assert.match(routes, /authRoutes\.delete\('\/admin\/users\/:id\/articles\/:articleId', requireAdmin/);
  assert.match(routes, /authRoutes\.post\('\/admin\/users\/:id\/articles\/:articleId\/regenerate-ai', requireAdmin/);
  assert.match(routes, /sourceType: 'admin-copy'/);
});

test('admin library reads and mutations are written to a durable audit trail', () => {
  const schema = read('src/db/schema.ts');
  const auditService = read('src/services/admin-audit.service.ts');
  const routes = read('src/routes/auth.ts');
  const index = read('src/index.ts');

  assert.match(schema, /export const adminAuditLogs = pgTable\('admin_audit_logs'/);
  assert.match(schema, /actorUserId: integer\('actor_user_id'\)/);
  assert.match(schema, /targetUserId: integer\('target_user_id'\)/);
  assert.match(auditService, /CREATE TABLE IF NOT EXISTS admin_audit_logs/);
  assert.match(auditService, /export async function writeAdminAudit/);
  assert.match(routes, /await writeAdminAudit\(/);
  assert.match(routes, /authRoutes\.get\('\/admin\/audit-logs', requireAdmin/);
  assert.match(index, /initAdminAuditSchema/);
});

test('admin UI exposes a separate library console and audit view instead of widening the personal inbox', () => {
  const api = readWorkspace('apps/web/src/lib/api.ts');
  const userManagement = readWorkspace('apps/web/src/components/content/UserManagementContent.tsx');
  const library = readWorkspace('apps/web/src/components/content/AdminLibraryContent.tsx');

  assert.match(api, /getAdminUserArticles/);
  assert.match(api, /getAdminAuditLogs/);
  assert.match(api, /copyAdminUserArticleToMine/);
  assert.match(userManagement, /openUserLibrary\(item\.id/);
  assert.match(library, /用户文章库/);
  assert.match(library, /审计记录/);
  assert.match(library, /复制到我的收件箱/);
  assert.match(library, /删除该用户记录/);
});
