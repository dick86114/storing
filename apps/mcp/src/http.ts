#!/usr/bin/env node
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createStoringMcpServer } from './storing-server.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, '../../../.env'), quiet: true });

const apiBase = process.env.STORING_API_BASE || 'http://localhost:1052/api/v1';
const port = Number(process.env.MCP_HTTP_PORT || 1053);
const allowedOrigins = (process.env.MCP_ALLOWED_ORIGINS || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

type VerifiedClient = {
  client_id: number;
  client_name: string;
  owner_user_id: number;
  owner_username: string;
  scopes: string[];
};

function bearerToken(header?: string) {
  if (!header?.startsWith('Bearer ')) return '';
  return header.slice('Bearer '.length).trim();
}

async function verifyApiKey(token: string): Promise<VerifiedClient | null> {
  const response = await fetch(`${apiBase}/mcp/auth/verify`, {
    headers: { Authorization: `Bearer ${token}` },
  }).catch(() => null);
  if (!response?.ok) return null;
  return response.json() as Promise<VerifiedClient>;
}

const app = new Hono();
app.use('/mcp', cors({
  origin: (origin) => {
    if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) return origin || '*';
    return '';
  },
  allowMethods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'MCP-Protocol-Version', 'Mcp-Session-Id', 'Last-Event-ID', 'X-MCP-Client-Name'],
  exposeHeaders: ['MCP-Protocol-Version', 'Mcp-Session-Id'],
}));

app.get('/health', (c) => c.json({ status: 'ok', transport: 'streamable-http', mode: 'stateless' }));

app.all('/mcp', async (c) => {
  const origin = c.req.header('Origin');
  if (origin && allowedOrigins.length > 0 && !allowedOrigins.includes(origin)) {
    return c.json({ error: { code: 'MCP_ORIGIN_FORBIDDEN', message: 'Origin 不在允许列表中' } }, 403);
  }

  const token = bearerToken(c.req.header('Authorization'));
  if (!token) {
    c.header('WWW-Authenticate', 'Bearer realm="storing-mcp"');
    return c.json({ error: { code: 'MCP_UNAUTHORIZED', message: '缺少 MCP API Key' } }, 401);
  }

  const client = await verifyApiKey(token);
  if (!client) {
    c.header('WWW-Authenticate', 'Bearer error="invalid_token"');
    return c.json({ error: { code: 'MCP_UNAUTHORIZED', message: 'MCP API Key 无效' } }, 401);
  }

  const clientAgent = (c.req.header('X-MCP-Client-Name') || c.req.header('User-Agent') || 'Unknown Streamable HTTP client').slice(0, 240);
  const server = createStoringMcpServer({ apiBase, transport: 'streamable-http', clientAgent, scopes: client.scopes });
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);

  return transport.handleRequest(c.req.raw, {
    authInfo: {
      token,
      clientId: String(client.client_id),
      scopes: client.scopes,
      extra: {
        ownerUserId: client.owner_user_id,
        ownerUsername: client.owner_username,
        clientName: client.client_name,
      },
    },
  });
});

serve({ fetch: app.fetch, port }, (info) => {
  console.log(`Storing Streamable HTTP MCP server listening on http://localhost:${info.port}/mcp`);
});
