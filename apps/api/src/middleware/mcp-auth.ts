import { Context, Next } from 'hono';
import { hasMcpScope, verifyMcpApiKey, type McpClientContext } from '../services/mcp-auth.service.js';

declare module 'hono' {
  interface ContextVariableMap {
    mcpClient: McpClientContext;
  }
}

function extractApiKey(c: Context) {
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice('Bearer '.length).trim();
  return c.req.header('X-Storing-Api-Key')?.trim() || '';
}

export async function requireMcpClient(c: Context, next: Next) {
  const apiKey = extractApiKey(c);
  if (!apiKey) {
    return c.json({ error: { code: 'MCP_UNAUTHORIZED', message: '缺少 MCP API Key' } }, 401);
  }

  const client = await verifyMcpApiKey(apiKey);
  if (!client) {
    return c.json({ error: { code: 'MCP_UNAUTHORIZED', message: 'MCP API Key 无效' } }, 401);
  }

  if (!client.enabled) {
    return c.json({ error: { code: 'MCP_CLIENT_DISABLED', message: 'MCP client 已禁用' } }, 403);
  }

  c.set('mcpClient', client);
  await next();
}

export function requireMcpScope(scope: string) {
  return async (c: Context, next: Next) => {
    const client = c.get('mcpClient');
    if (!client || !hasMcpScope(client, scope)) {
      return c.json({ error: { code: 'MCP_FORBIDDEN_SCOPE', message: `缺少权限：${scope}` } }, 403);
    }
    await next();
  };
}
