import { randomBytes, createHash, timingSafeEqual } from 'crypto';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { mcpClients, users } from '../db/schema.js';

export const MCP_API_KEY_PREFIX = 'sk-storing-';

export type McpClientContext = {
  id: number;
  name: string;
  ownerUserId: number;
  ownerUsername: string;
  scopes: string[];
  enabled: boolean;
  defaultSaveToInbox: boolean;
};

export function generateMcpApiKey() {
  return `${MCP_API_KEY_PREFIX}${randomBytes(32).toString('base64url')}`;
}

export function hashMcpApiKey(apiKey: string) {
  return createHash('sha256').update(apiKey).digest('hex');
}

function safeHashEquals(a: string, b: string) {
  const aBuffer = Buffer.from(a);
  const bBuffer = Buffer.from(b);
  if (aBuffer.length !== bBuffer.length) return false;
  return timingSafeEqual(aBuffer, bBuffer);
}

export async function initMcpSchema() {
  await db.execute(sql.raw(`ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'admin'`));
  await db.execute(sql.raw(`ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'`));
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS mcp_clients (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      owner_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      api_key_hash TEXT NOT NULL UNIQUE,
      scopes TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      rate_limit_per_minute INTEGER,
      rate_limit_per_day INTEGER,
      default_save_to_inbox BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      last_used_at TIMESTAMP
    )
  `));
}

export async function verifyMcpApiKey(apiKey: string): Promise<McpClientContext | null> {
  const trimmed = apiKey.trim();
  if (!trimmed.startsWith(MCP_API_KEY_PREFIX)) return null;

  const apiKeyHash = hashMcpApiKey(trimmed);
  const [client] = await db
    .select({
      id: mcpClients.id,
      name: mcpClients.name,
      ownerUserId: mcpClients.ownerUserId,
      ownerUsername: users.username,
      apiKeyHash: mcpClients.apiKeyHash,
      scopes: mcpClients.scopes,
      enabled: mcpClients.enabled,
      defaultSaveToInbox: mcpClients.defaultSaveToInbox,
    })
    .from(mcpClients)
    .innerJoin(users, eq(mcpClients.ownerUserId, users.id))
    .where(eq(mcpClients.apiKeyHash, apiKeyHash))
    .limit(1);

  if (!client || !safeHashEquals(client.apiKeyHash, apiKeyHash)) return null;

  await db
    .update(mcpClients)
    .set({ lastUsedAt: new Date(), updatedAt: new Date() })
    .where(eq(mcpClients.id, client.id));

  return {
    id: client.id,
    name: client.name,
    ownerUserId: client.ownerUserId,
    ownerUsername: client.ownerUsername,
    scopes: client.scopes ?? [],
    enabled: client.enabled,
    defaultSaveToInbox: client.defaultSaveToInbox,
  };
}

export function hasMcpScope(client: Pick<McpClientContext, 'scopes'>, scope: string) {
  return client.scopes.includes(scope);
}
