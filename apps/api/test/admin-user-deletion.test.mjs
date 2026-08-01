import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const apiRoot = new URL('../', import.meta.url);
const workspaceRoot = new URL('../../../', import.meta.url);
const readApi = (path) => readFileSync(new URL(path, apiRoot), 'utf8');
const readWorkspace = (path) => readFileSync(new URL(path, workspaceRoot), 'utf8');

test('管理员删除用户接口必须受管理员权限与账号保护约束', () => {
  const route = readApi('src/routes/auth.ts');

  assert.match(route, /authRoutes\.delete\('\/admin\/users\/:id', requireAdmin/);
  assert.match(route, /SELF_DELETE_FORBIDDEN/);
  assert.match(route, /ADMIN_DELETE_FORBIDDEN/);
  assert.match(route, /不能删除当前登录用户/);
  assert.match(route, /管理员账号受保护，不能删除/);
  assert.match(route, /adminDeleteUserSchema/);
  assert.match(route, /DELETE_CONFIRMATION_MISMATCH/);
});

test('删除用户必须在事务内处理关联数据，并保留全局 articles', () => {
  const route = readApi('src/routes/auth.ts');

  assert.match(route, /await db\.transaction\(async \(tx\) =>/);
  assert.match(route, /\.for\('update'\)/);
  assert.match(route, /tx\.update\(adminAuditLogs\)\.set\(\{ targetUserId: null \}\)/);
  assert.match(route, /tx\.update\(collectJobs\)\.set\(\{(?=[^}]*userId: null)(?=[^}]*clientId: null)[^}]*\}\)/);
  assert.match(route, /tx\.update\(mcpRequestLogs\)\.set\(\{ userId: null, clientId: null \}\)/);
  assert.match(route, /tx\.delete\(mobileSessions\)/);
  assert.match(route, /tx\.delete\(articleMetadata\)/);
  assert.match(route, /tx\.delete\(mcpClients\)/);
  assert.match(route, /tx\.delete\(users\)/);
  assert.doesNotMatch(route, /tx\.delete\(articles\)/);
  assert.match(route, /action: 'user_deleted'/);
  assert.match(route, /deleted_metadata_count/);
  assert.match(route, /deleted_mcp_client_count/);
  assert.match(route, /deleted_active_session_count/);

  const collectService = readApi('src/services/collect.service.ts');
  assert.match(collectService, /owner_deleted BOOLEAN NOT NULL DEFAULT FALSE/);
  assert.match(collectService, /owner_deleted = FALSE/);
  assert.ok((collectService.match(/eq\(collectJobs\.ownerDeleted, false\)/g) ?? []).length >= 4, '待处理、恢复、重试和抢占任务均必须跳过已删除归属');
});

test('管理端客户端与界面必须提供输入用户名确认的删除入口', () => {
  const api = readWorkspace('apps/web/src/lib/api.ts');
  const content = readWorkspace('apps/web/src/components/content/UserManagementContent.tsx');

  assert.match(api, /deleteAdminUser: \(id: number, confirmUsername: string\) =>[\s\S]*confirm_username/);
  assert.match(content, /DeleteOutlined/);
  assert.match(content, /api\.deleteAdminUser\(deletingUser\.id, deleteConfirmUsername\)/);
  assert.match(content, /删除用户/);
  assert.match(content, /确认删除/);
  assert.match(content, /deleteConfirmUsername !== deletingUser\.username/);
  assert.match(content, /全局文章不会删除/);
});
