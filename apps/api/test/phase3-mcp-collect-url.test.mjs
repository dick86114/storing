import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const apiRoot = new URL('../', import.meta.url);
const workspaceRoot = new URL('../../../', import.meta.url);
const readApi = (path) => readFileSync(new URL(path, apiRoot), 'utf8');
const readWorkspace = (path) => readFileSync(new URL(path, workspaceRoot), 'utf8');

test('API exposes MCP collect_url endpoint with both required scopes', () => {
  const route = readApi('src/routes/mcp.ts');
  assert.match(route, /mcpRoutes\.post\('\/mcp\/collect'[\s\S]*requireMcpScope\('collect:create'\)[\s\S]*requireMcpScope\('inbox:write'\)/);
  assert.match(route, /userId: client\.ownerUserId/);
  assert.match(route, /clientId: client\.id/);
  assert.match(route, /requestSource: 'mcp'/);
  assert.match(route, /saveToInbox: true/);
});

test('MCP server registers collect_url and calls /mcp/collect', () => {
  const server = readWorkspace('apps/mcp/src/storing-server.ts');
  assert.match(server, /server\.registerTool\(\s*'collect_url'/);
  assert.match(server, /apiFetch<CollectResult>\('\/mcp\/collect'/);
  assert.match(server, /job_id: z\.number\(\)/);
  assert.match(server, /saved_to_inbox: z\.literal\(true\)/);
});

test('MCP WeChat collection keeps saved items in inbox instead of defaulting to archive', () => {
  const collect = readApi('src/services/collect.service.ts');
  const processWechat = collect.match(/async function processWechatJob[\s\S]*?async function processSingleFileJob/)?.[0];
  assert.ok(processWechat, 'processWechatJob implementation should be present');
  assert.match(
    processWechat,
    /persistMetadata: options\.saveToInbox[\s\S]*?markArchived: shouldArchiveCollectedArticle\(options\.sourceType\)/,
  );
});
