import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const apiRoot = new URL('../', import.meta.url);
const readApi = (path) => readFileSync(new URL(path, apiRoot), 'utf8');

test('schema and init create mcp_request_logs audit table', () => {
  const schema = readApi('src/db/schema.ts');
  const authService = readApi('src/services/mcp-auth.service.ts');
  assert.match(schema, /export const mcpRequestLogs = pgTable\('mcp_request_logs'/);
  assert.match(authService, /CREATE TABLE IF NOT EXISTS mcp_request_logs/);
  assert.match(authService, /CREATE INDEX IF NOT EXISTS mcp_request_logs_client_created_idx/);
});

test('MCP auth service exposes rate-limit check and audit logging helpers', () => {
  const authService = readApi('src/services/mcp-auth.service.ts');
  assert.match(authService, /rateLimitPerMinute: number \| null;/);
  assert.match(authService, /rateLimitPerDay: number \| null;/);
  assert.match(authService, /export async function checkMcpRateLimit/);
  assert.match(authService, /export async function logMcpRequest/);
  assert.match(authService, /MCP_RATE_LIMITED/);
});

test('MCP middleware enforces rate limits after auth and provides audit middleware', () => {
  const middleware = readApi('src/middleware/mcp-auth.ts');
  assert.match(middleware, /checkMcpRateLimit/);
  assert.match(middleware, /MCP_RATE_LIMITED/);
  assert.match(middleware, /export function auditMcpRequest/);
  assert.match(middleware, /logMcpRequest/);
});

test('MCP routes attach audit middleware to summarize, collect, and status tools', () => {
  const route = readApi('src/routes/mcp.ts');
  assert.match(route, /auditMcpRequest\('summarize_url'\)/);
  assert.match(route, /auditMcpRequest\('collect_url'\)/);
  assert.match(route, /auditMcpRequest\('get_collect_status'\)/);
});
