import { Context, Next } from 'hono';
import {
  checkMcpRateLimit,
  hasMcpScope,
  logMcpRequest,
  verifyMcpApiKey,
  type McpClientContext,
} from '../services/mcp-auth.service.js';

declare module 'hono' {
  interface ContextVariableMap {
    mcpClient: McpClientContext;
    mcpAuditUrl?: string | null;
    mcpAuditNormalizedUrl?: string | null;
    mcpAuditErrorCode?: string | null;
  }
}

function extractApiKey(c: Context) {
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice('Bearer '.length).trim();
  return c.req.header('X-Storing-Api-Key')?.trim() || '';
}

function auditRequestContext(c: Context) {
  const transport = (c.req.header('X-Storing-MCP-Transport') || 'direct-api').slice(0, 64);
  const clientAgent = (c.req.header('X-Storing-MCP-Client') || c.req.header('User-Agent') || '').slice(0, 240) || null;
  return {
    transport,
    clientAgent,
    requestMethod: c.req.method,
    requestPath: c.req.path,
  };
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
      c.set('mcpAuditErrorCode', 'MCP_FORBIDDEN_SCOPE');
      return c.json({ error: { code: 'MCP_FORBIDDEN_SCOPE', message: `缺少权限：${scope}` } }, 403);
    }
    await next();
  };
}

export function auditMcpRequest(toolName: string) {
  return async (c: Context, next: Next) => {
    const startedAt = Date.now();
    const client = c.get('mcpClient');
    const rateLimit = await checkMcpRateLimit(client);
    if (!rateLimit.allowed) {
      await logMcpRequest({
        clientId: client.id,
        userId: client.ownerUserId,
        toolName,
        status: 'rate_limited',
        errorCode: 'MCP_RATE_LIMITED',
        durationMs: Date.now() - startedAt,
        ...auditRequestContext(c),
      });
      return c.json({
        error: {
          code: 'MCP_RATE_LIMITED',
          message: `MCP client 调用过于频繁，已超过每${rateLimit.window === 'minute' ? '分钟' : '日'} ${rateLimit.limit} 次限制`,
          window: rateLimit.window,
          limit: rateLimit.limit,
        },
      }, 429);
    }

    try {
      await next();
    } finally {
      const statusCode = c.res.status;
      const explicitError = c.get('mcpAuditErrorCode') ?? null;
      const errorCode = explicitError ?? (statusCode >= 400 ? `HTTP_${statusCode}` : null);
      await logMcpRequest({
        clientId: client?.id ?? null,
        userId: client?.ownerUserId ?? null,
        toolName,
        url: c.get('mcpAuditUrl') ?? null,
        normalizedUrl: c.get('mcpAuditNormalizedUrl') ?? null,
        status: errorCode === 'MCP_RATE_LIMITED' ? 'rate_limited' : statusCode >= 400 ? 'error' : 'success',
        errorCode,
        durationMs: Date.now() - startedAt,
        ...auditRequestContext(c),
      }).catch((error) => {
        console.error('MCP audit log failed:', error instanceof Error ? error.message : String(error));
      });
    }
  };
}
