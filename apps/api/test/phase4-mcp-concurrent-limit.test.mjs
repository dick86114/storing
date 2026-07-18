import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const apiRoot = new URL('../', import.meta.url);
const readApi = (path) => readFileSync(new URL(path, apiRoot), 'utf8');

test('MCP client schema and init support concurrent_collect_limit', () => {
  const schema = readApi('src/db/schema.ts');
  const service = readApi('src/services/mcp-auth.service.ts');
  assert.match(schema, /concurrentCollectLimit: integer\('concurrent_collect_limit'\)/);
  assert.match(service, /concurrent_collect_limit INTEGER/);
  assert.match(service, /ALTER TABLE mcp_clients ADD COLUMN IF NOT EXISTS concurrent_collect_limit INTEGER/);
});

test('MCP auth service exposes concurrent collect limit check based on active collect jobs', () => {
  const service = readApi('src/services/mcp-auth.service.ts');
  assert.match(service, /export async function checkMcpConcurrentCollectLimit/);
  assert.match(service, /FROM collect_jobs/);
  assert.match(service, /status IN \('pending', 'running'\)/);
  assert.match(service, /MCP_RATE_LIMITED/);
  assert.match(service, /concurrent/);
});

test('MCP routes enforce concurrent collect limit only on job-creating tools', () => {
  const route = readApi('src/routes/mcp.ts');
  assert.match(route, /checkMcpConcurrentCollectLimit/);
  assert.match(route, /ensureMcpCollectSlot\(c\)/);
  assert.match(route, /mcpRoutes\.post\('\/mcp\/summarize'[\s\S]*ensureMcpCollectSlot\(c\)[\s\S]*createCollectJob/);
  assert.match(route, /mcpRoutes\.post\('\/mcp\/collect'[\s\S]*ensureMcpCollectSlot\(c\)[\s\S]*createCollectJob/);
  assert.doesNotMatch(route, /mcpRoutes\.get\('\/mcp\/jobs\/:id'[\s\S]*ensureMcpCollectSlot\(c\)/);
});

test('MCP admin APIs can view and update concurrent_collect_limit', () => {
  const route = readApi('src/routes/mcp.ts');
  const service = readApi('src/services/mcp-auth.service.ts');
  assert.match(route, /concurrent_collect_limit/);
  assert.match(service, /concurrentCollectLimit/);
});
