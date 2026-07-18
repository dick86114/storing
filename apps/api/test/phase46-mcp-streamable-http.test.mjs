import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';

const apiRoot = new URL('../', import.meta.url);
const workspaceRoot = new URL('../../../', import.meta.url);
const readApi = (path) => readFileSync(new URL(path, apiRoot), 'utf8');
const readWorkspace = (path) => readFileSync(new URL(path, workspaceRoot), 'utf8');

test('API exposes MCP API key introspection for remote transport', () => {
  const route = readApi('src/routes/mcp.ts');
  assert.match(route, /mcpRoutes\.get\('\/mcp\/auth\/verify', requireMcpClient/);
  assert.match(route, /owner_user_id/);
  assert.match(route, /scopes/);
});

test('MCP package supports both stdio and Streamable HTTP', () => {
  const sharedPath = new URL('apps/mcp/src/storing-server.ts', workspaceRoot);
  const httpPath = new URL('apps/mcp/src/http.ts', workspaceRoot);
  assert.equal(existsSync(sharedPath), true);
  assert.equal(existsSync(httpPath), true);
  const stdio = readWorkspace('apps/mcp/src/index.ts');
  const http = readWorkspace('apps/mcp/src/http.ts');
  const shared = readWorkspace('apps/mcp/src/storing-server.ts');
  assert.match(stdio, /StdioServerTransport/);
  assert.match(http, /WebStandardStreamableHTTPServerTransport/);
  assert.match(http, /sessionIdGenerator: undefined/);
  assert.match(http, /Authorization/);
  assert.match(http, /\/mcp\/auth\/verify/);
  assert.match(shared, /createStoringMcpServer/);
  assert.match(shared, /extra\.authInfo\?\.token/);
});

test('local and container launchers expose remote MCP HTTP service', () => {
  const restart = readWorkspace('restart.sh');
  const compose = readWorkspace('docker-compose.yml');
  const dockerfile = readWorkspace('Dockerfile');
  const nextConfig = readWorkspace('apps/web/next.config.ts');
  assert.match(restart, /MCP_HTTP_PORT=1053/);
  assert.match(restart, /src\/http\.ts/);
  assert.match(compose, /1053:1053/);
  assert.match(dockerfile, /apps\/mcp/);
  assert.match(nextConfig, /source: '\/mcp'/);
});

test('web onboarding prefers remote Streamable HTTP configuration', () => {
  const content = readWorkspace('apps/web/src/components/content/McpSettingsContent.tsx');
  assert.match(content, /Streamable HTTP/);
  assert.match(content, /url: remoteMcpUrl\(\)/);
  assert.match(content, /Authorization: `Bearer/);
});

test('MCP summary waits for a terminal job state by default and preserves an explicit async fallback', () => {
  const route = readApi('src/routes/mcp.ts');
  const collectService = readApi('src/services/collect.service.ts');
  const shared = readWorkspace('apps/mcp/src/storing-server.ts');

  assert.match(collectService, /export async function waitForCollectJob/);
  assert.match(route, /wait_seconds/);
  assert.match(route, /waitForCollectJob\(id, \{ clientId: client\.id, requestSource: 'mcp' \}, waitSeconds \* 1000\)/);
  assert.match(shared, /wait_for_result/);
  assert.match(shared, /wait_timeout_seconds/);
  assert.match(shared, /waitForMcpJob/);
  assert.match(shared, /wait_for_result \?\? true/);
  assert.match(shared, /\/mcp\/jobs\/\$\{jobId\}\?wait_seconds=\$\{waitTimeoutSeconds\}/);
});

test('MCP server only exposes collect_url when client has collect and inbox scopes', () => {
  const shared = readWorkspace('apps/mcp/src/storing-server.ts');
  const http = readWorkspace('apps/mcp/src/http.ts');

  assert.match(shared, /scopes\?: string\[\]/);
  assert.match(shared, /hasScope\(options\.scopes, 'collect:create'\)/);
  assert.match(shared, /hasScope\(options\.scopes, 'inbox:write'\)/);
  assert.match(http, /scopes: client\.scopes/);
});

test('summarize_url output schema includes all fields returned in terminal state', () => {
  const shared = readWorkspace('apps/mcp/src/storing-server.ts');
  const compactMobileStyles = shared;

  assert.match(compactMobileStyles, /stage: z\.string\(\)\.optional\(\)/);
  assert.match(compactMobileStyles, /article_id: z\.number\(\)\.nullable\(\)\.optional\(\)/);
  assert.match(compactMobileStyles, /saved_to_inbox: z\.boolean\(\)\.optional\(\)/);
  assert.match(compactMobileStyles, /created_at: z\.string\(\)\.optional\(\)/);
  assert.match(compactMobileStyles, /updated_at: z\.string\(\)\.optional\(\)/);
});
