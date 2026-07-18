import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const apiRoot = new URL('../', import.meta.url);
const workspaceRoot = new URL('../../../', import.meta.url);
const readApi = (path) => readFileSync(new URL(path, apiRoot), 'utf8');
const readWorkspace = (path) => readFileSync(new URL(path, workspaceRoot), 'utf8');

test('Phase 4.5 plan is documented before Phase 5', () => {
  const plan = readWorkspace('docs/MCP-Summary-Service-Development-Plan.md');
  assert.match(plan, /Phase 4\.5 \| MCP 管理控制台与接入引导/);
  assert.match(plan, /管理员创建 MCP client，并一次性返回明文 API Key/);
  assert.match(plan, /新增 `\/settings\/mcp` 我的 MCP 页面/);
});

test('admin user APIs support user-space management for MCP owners', () => {
  const authRoute = readApi('src/routes/auth.ts');
  assert.match(authRoute, /authRoutes\.get\('\/admin\/users', requireAdmin/);
  assert.match(authRoute, /authRoutes\.post\('\/admin\/users', requireAdmin/);
  assert.match(authRoute, /authRoutes\.patch\('\/admin\/users\/:id', requireAdmin/);
  assert.match(authRoute, /bcrypt\.hash/);
  assert.match(authRoute, /role: parsed\.data\.role/);
  assert.match(authRoute, /status: parsed\.data\.status/);
});

test('admin MCP APIs support full client lifecycle', () => {
  const route = readApi('src/routes/mcp.ts');
  const service = readApi('src/services/mcp-auth.service.ts');
  assert.match(route, /mcpRoutes\.post\('\/admin\/mcp\/clients', requireAdmin/);
  assert.match(route, /mcpRoutes\.delete\('\/admin\/mcp\/clients\/:id', requireAdmin/);
  assert.match(route, /api_key: result\.apiKey/);
  assert.match(service, /export async function createMcpClient/);
  assert.match(service, /export async function deleteMcpClient/);
  assert.match(service, /ownerStatus/);
});

test('web MCP settings console wires users, clients, logs, and guide APIs', () => {
  const pagePath = new URL('apps/web/src/app/(main)/settings/mcp/page.tsx', workspaceRoot);
  const contentPath = new URL('apps/web/src/components/content/McpSettingsContent.tsx', workspaceRoot);
  assert.equal(existsSync(pagePath), true);
  assert.equal(existsSync(contentPath), true);
  const api = readWorkspace('apps/web/src/lib/api.ts');
  const content = readWorkspace('apps/web/src/components/content/McpSettingsContent.tsx');
  assert.match(api, /getAdminUsers/);
  assert.match(api, /createMcpClient/);
  assert.match(api, /deleteMcpClient/);
  assert.match(api, /rotateMcpClientKey/);
  assert.match(content, /Streamable HTTP/);
  assert.match(content, /summarize_url/);
  assert.match(content, /collect_url/);
  assert.match(content, /get_collect_status/);
});

test('authenticated users can self-manage only their own MCP clients', () => {
  const route = readApi('src/routes/mcp.ts');
  const service = readApi('src/services/mcp-auth.service.ts');
  assert.match(route, /mcpRoutes\.get\('\/mcp\/me\/clients', requireAuth/);
  assert.match(route, /mcpRoutes\.post\('\/mcp\/me\/clients', requireAuth/);
  assert.match(route, /ownerUserId: currentUser\.id/);
  assert.match(route, /mcpRoutes\.post\('\/mcp\/me\/clients\/:id\/rotate-key', requireAuth/);
  assert.match(route, /mcpRoutes\.delete\('\/mcp\/me\/clients\/:id', requireAuth/);
  assert.match(route, /mcpRoutes\.get\('\/mcp\/me\/request-logs', requireAuth/);
  assert.match(service, /ownerUserId === undefined \? eq\(mcpClients\.id, id\)/);
  assert.match(service, /options\.userId/);
});

test('user and admin MCP surfaces are separate routes', () => {
  const workspace = readWorkspace('apps/web/src/components/content/McpSettingsContent.tsx');
  assert.match(workspace, /export function McpSettingsContent/);
  assert.match(workspace, /export function McpAdminContent/);
  assert.match(workspace, /我的 MCP/);
  assert.match(workspace, /运营控制台/);
});

test('self-service users receive server-managed limits instead of choosing their own quota', () => {
  const route = readApi('src/routes/mcp.ts');
  const content = readWorkspace('apps/web/src/components/content/McpSettingsContent.tsx');
  assert.match(route, /getMcpPlatformSettings\(\)/);
  assert.match(route, /createMyMcpClientSchema = createMcpClientSchema\.omit\([\s\S]*rate_limit_per_minute: true/);
  assert.match(route, /updateMyMcpClientSchema = updateMcpClientSchema\.omit\([\s\S]*concurrent_collect_limit: true/);
  assert.match(content, /平台基础配额/);
  assert.match(content, /allowLimitEditing/);
  assert.doesNotMatch(content, /api\.createMyMcpClient\([\s\S]{0,500}rate_limit_per_minute/);
});

test('admins can configure platform default MCP limits used by self-service clients', () => {
  const schema = readApi('src/db/schema.ts');
  const route = readApi('src/routes/mcp.ts');
  const service = readApi('src/services/mcp-auth.service.ts');
  const content = readWorkspace('apps/web/src/components/content/McpSettingsContent.tsx');
  assert.match(schema, /mcpPlatformSettings/);
  assert.match(service, /export async function getMcpPlatformSettings/);
  assert.match(service, /export async function updateMcpPlatformSettings/);
  assert.match(route, /mcpRoutes\.get\('\/admin\/mcp\/default-limits', requireAdmin/);
  assert.match(route, /mcpRoutes\.patch\('\/admin\/mcp\/default-limits', requireAdmin/);
  assert.match(route, /getMcpPlatformSettings\(\)/);
  assert.match(content, /平台默认配额/);
  assert.match(content, /getMcpPlatformLimits/);
  assert.match(content, /updateMcpPlatformLimits/);
});

test('user management is a system-level admin module separate from MCP operations', () => {
  const authRoute = readApi('src/routes/auth.ts');
  const userPage = new URL('apps/web/src/app/(main)/admin/users/page.tsx', workspaceRoot);
  const userContent = new URL('apps/web/src/components/content/UserManagementContent.tsx', workspaceRoot);
  const mcpContent = readWorkspace('apps/web/src/components/content/McpSettingsContent.tsx');
  assert.equal(existsSync(userPage), true);
  assert.equal(existsSync(userContent), true);
  assert.match(authRoute, /mcp_client_count/);
  assert.match(authRoute, /mcp_request_count/);
  assert.match(authRoute, /inbox_count/);
  assert.match(authRoute, /archive_count/);
  assert.doesNotMatch(mcpContent, /function AdminUsers/);
  assert.doesNotMatch(mcpContent, /创建用户空间/);
});

test('configured administrator has an auditable recovery status and explicit environment-password reset flow', () => {
  const index = readApi('src/index.ts');
  const authRoute = readApi('src/routes/auth.ts');
  const webApi = readWorkspace('apps/web/src/lib/api.ts');
  const userContent = readWorkspace('apps/web/src/components/content/UserManagementContent.tsx');

  assert.match(index, /ensureConfiguredAdmin/);
  assert.match(authRoute, /authRoutes\.get\('\/admin\/bootstrap-status', requireAdmin/);
  assert.match(authRoute, /authRoutes\.post\('\/admin\/bootstrap\/reset-password', requireAdmin/);
  assert.match(authRoute, /configured_password_matches/);
  assert.match(authRoute, /confirm_username/);
  assert.match(webApi, /getAdminBootstrapStatus/);
  assert.match(webApi, /resetConfiguredAdminPassword/);
  assert.match(userContent, /管理员维护/);
  assert.match(userContent, /isAdminMaintenanceOpen/);
  assert.match(userContent, /同步环境密码/);
});

test('user directory qualifies correlated usage metrics and keeps creation and maintenance in dialogs', () => {
  const authRoute = readApi('src/routes/auth.ts');
  const webApi = readWorkspace('apps/web/src/lib/api.ts');
  const userContent = readWorkspace('apps/web/src/components/content/UserManagementContent.tsx');

  assert.match(authRoute, /const parentUserId = sql\.raw\('\"users\"\.\"id\"'\);/);
  assert.match(authRoute, /ADMIN_DISABLE_FORBIDDEN/);
  assert.match(authRoute, /ADMIN_ROLE_CHANGE_FORBIDDEN/);
  assert.match(authRoute, /username: z\.string\(\)\.trim\(\)\.min\(2/);
  assert.match(webApi, /username\?: string/);
  assert.match(userContent, /服务账号/);
  assert.match(userContent, /isCreateModalOpen/);
  assert.match(userContent, /isAdminMaintenanceOpen/);
  assert.match(userContent, /editingUser/);
  assert.match(userContent, /编辑用户/);
  assert.match(userContent, /新建用户/);
  assert.doesNotMatch(userContent, /user-admin-create/);
});

test('user directory search icon is anchored through Ant Design’s wrapper element', () => {
  const styles = readWorkspace('apps/web/src/app/globals.css');
  assert.match(styles, /\.user-admin-search > \.anticon \{\n  position: absolute;\n  top: 50%;\n  left: 12px;/);
  assert.match(styles, /\.user-admin-search > \.anticon \{[\s\S]*transform: translateY\(-50%\);/);
});

test('user directory cards separate identity and actions from usage metrics with icon-only editing', () => {
  const content = readWorkspace('apps/web/src/components/content/UserManagementContent.tsx');
  const styles = readWorkspace('apps/web/src/app/globals.css');

  assert.match(content, /className="user-admin-card-head"/);
  assert.match(content, /className="user-admin-edit-button"/);
  assert.match(content, /aria-label="编辑用户"/);
  assert.doesNotMatch(content, /<EditOutlined \/> 编辑用户/);
  assert.match(styles, /\.user-admin-card \{\n  display: grid;\n  grid-template-columns: 1fr;/);
  assert.match(styles, /\.user-admin-card-head \{\n  display: flex;/);
});

test('user activity tracks login time and exposes MCP connection and request detail', () => {
  const schema = readApi('src/db/schema.ts');
  const index = readApi('src/index.ts');
  const authRoute = readApi('src/routes/auth.ts');
  const webApi = readWorkspace('apps/web/src/lib/api.ts');
  const userContent = readWorkspace('apps/web/src/components/content/UserManagementContent.tsx');

  assert.match(schema, /lastLoginAt: timestamp\('last_login_at'\)/);
  assert.match(index, /initUserManagementSchema/);
  assert.match(authRoute, /lastLoginAt: new Date\(\)/);
  assert.match(authRoute, /authRoutes\.get\('\/admin\/users\/:id\/activity', requireAdmin/);
  assert.match(authRoute, /last_login_at/);
  assert.match(webApi, /getAdminUserActivity/);
  assert.match(userContent, /openActivityModal/);
  assert.match(userContent, /user-admin-usage-button/);
  assert.match(userContent, /共 {item\.mcp_client_count} 个/);
  assert.match(userContent, /最近 MCP 调用/);
});

test('user activity modal stays within the viewport and paginates logs without scrolling the background', () => {
  const authRoute = readApi('src/routes/auth.ts');
  const webApi = readWorkspace('apps/web/src/lib/api.ts');
  const content = readWorkspace('apps/web/src/components/content/UserManagementContent.tsx');
  const styles = readWorkspace('apps/web/src/app/globals.css');

  assert.match(authRoute, /const offset = Math\.max\(0, Number\(c\.req\.query\('offset'\) \|\| 0\)\);/);
  assert.match(authRoute, /logs_total:/);
  assert.match(webApi, /getAdminUserActivity: \(id: number, limit = 20, offset = 0\)/);
  assert.match(content, /ACTIVITY_PAGE_SIZE = 3/);
  assert.match(content, /activityOffset/);
  assert.match(content, /onMouseDown=\{\(event\) => \{ if \(event\.target === event\.currentTarget\)/);
  assert.match(styles, /max-height: calc\(100dvh - 32px\);/);
  assert.match(styles, /overscroll-behavior: contain;/);
  const mobileActivityStyles = styles.slice(styles.indexOf('/* Mobile activity modal uses pagination instead of scrolling */'));
  assert.match(mobileActivityStyles, /\.user-admin-activity-content \{[\s\S]*overflow: visible;/);
  assert.match(mobileActivityStyles, /\.user-admin-client-list \{[\s\S]*max-height: none;/);
  assert.match(mobileActivityStyles, /\.user-admin-log-list > div small \{[\s\S]*-webkit-line-clamp: 2;/);
});

test('activity timestamps normalize UTC values and expose MCP transport audit context', () => {
  const authRoute = readApi('src/routes/auth.ts');
  const schema = readApi('src/db/schema.ts');
  const service = readApi('src/services/mcp-auth.service.ts');
  const middleware = readApi('src/middleware/mcp-auth.ts');
  const mcpServer = readWorkspace('apps/mcp/src/storing-server.ts');
  const httpServer = readWorkspace('apps/mcp/src/http.ts');
  const userContent = readWorkspace('apps/web/src/components/content/UserManagementContent.tsx');

  assert.match(authRoute, /function timestampToIso/);
  assert.match(authRoute, /last_mcp_used_at: timestampToIso/);
  assert.match(schema, /transport: text\('transport'\)/);
  assert.match(schema, /clientAgent: text\('client_agent'\)/);
  assert.match(service, /ADD COLUMN IF NOT EXISTS transport TEXT/);
  assert.match(middleware, /X-Storing-MCP-Transport/);
  assert.match(mcpServer, /X-Storing-MCP-Transport/);
  assert.match(httpServer, /transport: 'streamable-http'/);
  assert.match(authRoute, /transport: log\.transport/);
  assert.match(userContent, /调用方式/);
});

test('mobile MCP and user management preserve desktop information in a compact layout', () => {
  const styles = readWorkspace('apps/web/src/app/globals.css');
  const userContent = readWorkspace('apps/web/src/components/content/UserManagementContent.tsx');

  assert.match(userContent, /最后登录 \{dateText\(item\.last_login_at\)\} · 最近 MCP 调用 \{dateText\(item\.last_mcp_used_at\)\}/);
  assert.match(userContent, /<span>MCP 连接<\/span><strong>共 \{item\.mcp_client_count\} 个<\/strong><small>/);
  assert.match(userContent, /<span>MCP 调用<\/span><strong>\{item\.mcp_request_count\} 次<\/strong><small>/);
  assert.match(styles, /\/\* Compact mobile MCP and user-management layouts \*\//);
  assert.match(styles, /\.mcp-header-actions \.mcp-btn \{[\s\S]*width: auto;/);
  assert.match(styles, /\.mcp-empty-state \.mcp-btn \{[\s\S]*width: auto;/);
  assert.match(styles, /\.mcp-connection-actions \.mcp-btn \{[\s\S]*width: auto;/);
  const compactMobileStyles = styles.slice(styles.indexOf('/* Compact mobile MCP and user-management layouts */'));
  assert.match(compactMobileStyles, /\.mcp-chevron \{[\s\S]*grid-column: auto;/);
  assert.match(styles, /\.mcp-admin-metrics small \{[\s\S]*display: block;/);
  assert.match(styles, /\.user-admin-usage \{[\s\S]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\);/);
  assert.match(styles, /\.user-admin-usage-button small \{[\s\S]*display: -webkit-box;/);
});

test('mobile user management keeps administration actions and directory filters on one compact row', () => {
  const styles = readWorkspace('apps/web/src/app/globals.css');
  const compactMobileStyles = styles.slice(styles.indexOf('/* Compact mobile MCP and user-management layouts */'));

  assert.match(compactMobileStyles, /\.user-admin-header \.mcp-header-actions \{[\s\S]*width: 100%;[\s\S]*flex-wrap: nowrap;/);
  assert.match(compactMobileStyles, /\.user-admin-header \.mcp-header-actions \{[\s\S]*display: flex;/);
  assert.match(compactMobileStyles, /\.user-admin-header \.mcp-header-actions \.mcp-btn \{[\s\S]*flex: 0 1 auto;/);
  assert.match(compactMobileStyles, /\.user-admin-toolbar \{[\s\S]*grid-template-columns: minmax\(0, 1\.2fr\) minmax\(0, \.9fr\) minmax\(0, \.9fr\);/);
  assert.match(compactMobileStyles, /\.user-admin-search \{[\s\S]*grid-column: auto;/);
});

test('mobile MCP admin header keeps its three management actions on one compact row', () => {
  const styles = readWorkspace('apps/web/src/app/globals.css');
  const compactMobileStyles = styles.slice(styles.indexOf('/* Compact mobile MCP and user-management layouts */'));

  assert.match(compactMobileStyles, /\.mcp-admin-header \.mcp-header-actions \{[\s\S]*display: flex;[\s\S]*width: 100%;[\s\S]*flex-wrap: nowrap;/);
  assert.match(compactMobileStyles, /\.mcp-admin-header \.mcp-header-actions \.mcp-btn \{[\s\S]*flex: 0 1 auto;[\s\S]*width: auto;/);
});

test('MCP settings uses preset profiles instead of individual scope checkboxes', () => {
  const content = readWorkspace('apps/web/src/components/content/McpSettingsContent.tsx');
  assert.match(content, /MCP_PRESETS/);
  assert.match(content, /只读摘要/);
  assert.match(content, /摘要\+入库/);
  assert.doesNotMatch(content, /mcp-scope-picker/);
  assert.doesNotMatch(content, /default_save_to_inbox/);
  assert.doesNotMatch(content, /defaultSaveToInbox/);
});

test('MCP settings create form no longer shows unused default_save_to_inbox checkbox', () => {
  const content = readWorkspace('apps/web/src/components/content/McpSettingsContent.tsx');
  assert.doesNotMatch(content, /默认保存到收件箱/);
  assert.doesNotMatch(content, /mcp-check-field/);
});
