import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const apiRoot = new URL('../', import.meta.url);
const readApi = (path) => readFileSync(new URL(path, apiRoot), 'utf8');

test('auth middleware exposes requireAdmin for MCP management APIs', () => {
  const auth = readApi('src/middleware/auth.ts');
  assert.match(auth, /export async function requireAdmin/);
  assert.match(auth, /role !== 'admin'/);
  assert.match(auth, /ADMIN_REQUIRED/);
});

test('MCP route exposes admin client management endpoints', () => {
  const route = readApi('src/routes/mcp.ts');
  assert.match(route, /mcpRoutes\.get\('\/admin\/mcp\/clients', requireAdmin/);
  assert.match(route, /mcpRoutes\.patch\('\/admin\/mcp\/clients\/:id', requireAdmin/);
  assert.match(route, /mcpRoutes\.post\('\/admin\/mcp\/clients\/:id\/rotate-key', requireAdmin/);
  assert.match(route, /mcpRoutes\.get\('\/admin\/mcp\/request-logs', requireAdmin/);
});

test('MCP auth service exposes management helpers and API key rotation', () => {
  const service = readApi('src/services/mcp-auth.service.ts');
  assert.match(service, /export async function listMcpClients/);
  assert.match(service, /export async function updateMcpClient/);
  assert.match(service, /export async function rotateMcpClientApiKey/);
  assert.match(service, /export async function listMcpRequestLogs/);
  assert.match(service, /generateMcpApiKey\(\)/);
  assert.match(service, /hashMcpApiKey\(apiKey\)/);
});
