import { randomBytes, createHash, timingSafeEqual } from 'crypto';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { collectJobs, mcpClients, mcpPlatformSettings, mcpRequestLogs, users } from '../db/schema.js';

export const MCP_API_KEY_PREFIX = 'sk-storing-';

function positiveEnvLimit(name: string, fallback: number) {
  const parsed = Number(process.env[name]);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

const INITIAL_SELF_SERVICE_MCP_RATE_LIMIT_PER_MINUTE = positiveEnvLimit('SELF_SERVICE_MCP_RATE_LIMIT_PER_MINUTE', 20);
const INITIAL_SELF_SERVICE_MCP_RATE_LIMIT_PER_DAY = positiveEnvLimit('SELF_SERVICE_MCP_RATE_LIMIT_PER_DAY', 500);
const INITIAL_SELF_SERVICE_MCP_CONCURRENT_COLLECT_LIMIT = positiveEnvLimit('SELF_SERVICE_MCP_CONCURRENT_COLLECT_LIMIT', 3);

export type McpClientContext = {
  id: number;
  name: string;
  ownerUserId: number;
  ownerUsername: string;
  scopes: string[];
  enabled: boolean;
  defaultSaveToInbox: boolean;
  rateLimitPerMinute: number | null;
  rateLimitPerDay: number | null;
  concurrentCollectLimit: number | null;
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
      concurrent_collect_limit INTEGER,
      default_save_to_inbox BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      last_used_at TIMESTAMP
    )
  `));
  await db.execute(sql.raw(`ALTER TABLE mcp_clients ADD COLUMN IF NOT EXISTS concurrent_collect_limit INTEGER`));
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS mcp_platform_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      rate_limit_per_minute INTEGER NOT NULL DEFAULT 20,
      rate_limit_per_day INTEGER NOT NULL DEFAULT 500,
      concurrent_collect_limit INTEGER NOT NULL DEFAULT 3,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `));
  await db.execute(sql`
    INSERT INTO mcp_platform_settings (id, rate_limit_per_minute, rate_limit_per_day, concurrent_collect_limit, updated_at)
    VALUES (1, ${INITIAL_SELF_SERVICE_MCP_RATE_LIMIT_PER_MINUTE}, ${INITIAL_SELF_SERVICE_MCP_RATE_LIMIT_PER_DAY}, ${INITIAL_SELF_SERVICE_MCP_CONCURRENT_COLLECT_LIMIT}, NOW())
    ON CONFLICT (id) DO NOTHING
  `);
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS mcp_request_logs (
      id SERIAL PRIMARY KEY,
      client_id INTEGER REFERENCES mcp_clients(id) ON DELETE SET NULL,
      user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      tool_name TEXT NOT NULL,
      url TEXT,
      normalized_url TEXT,
      status TEXT NOT NULL,
      error_code TEXT,
      duration_ms INTEGER,
      transport TEXT,
      client_agent TEXT,
      request_method TEXT,
      request_path TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `));
  await db.execute(sql.raw(`ALTER TABLE mcp_request_logs ADD COLUMN IF NOT EXISTS transport TEXT`));
  await db.execute(sql.raw(`ALTER TABLE mcp_request_logs ADD COLUMN IF NOT EXISTS client_agent TEXT`));
  await db.execute(sql.raw(`ALTER TABLE mcp_request_logs ADD COLUMN IF NOT EXISTS request_method TEXT`));
  await db.execute(sql.raw(`ALTER TABLE mcp_request_logs ADD COLUMN IF NOT EXISTS request_path TEXT`));
  await db.execute(sql.raw(`
    CREATE INDEX IF NOT EXISTS mcp_request_logs_client_created_idx
    ON mcp_request_logs(client_id, created_at DESC)
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
      ownerStatus: users.status,
      apiKeyHash: mcpClients.apiKeyHash,
      scopes: mcpClients.scopes,
      enabled: mcpClients.enabled,
      defaultSaveToInbox: mcpClients.defaultSaveToInbox,
      rateLimitPerMinute: mcpClients.rateLimitPerMinute,
      rateLimitPerDay: mcpClients.rateLimitPerDay,
      concurrentCollectLimit: mcpClients.concurrentCollectLimit,
    })
    .from(mcpClients)
    .innerJoin(users, eq(mcpClients.ownerUserId, users.id))
    .where(eq(mcpClients.apiKeyHash, apiKeyHash))
    .limit(1);

  if (!client || !safeHashEquals(client.apiKeyHash, apiKeyHash)) return null;
  if (client.ownerStatus !== 'active') return null;

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
    rateLimitPerMinute: client.rateLimitPerMinute,
    rateLimitPerDay: client.rateLimitPerDay,
    concurrentCollectLimit: client.concurrentCollectLimit,
  };
}

export function hasMcpScope(client: Pick<McpClientContext, 'scopes'>, scope: string) {
  return client.scopes.includes(scope);
}


export type McpRateLimitResult =
  | { allowed: true }
  | { allowed: false; errorCode: 'MCP_RATE_LIMITED'; window: 'minute' | 'day' | 'concurrent'; limit: number; count: number };

export async function checkMcpRateLimit(client: Pick<McpClientContext, 'id' | 'rateLimitPerMinute' | 'rateLimitPerDay'>): Promise<McpRateLimitResult> {
  if (client.rateLimitPerMinute && client.rateLimitPerMinute > 0) {
    const result = await db.execute(sql`
      SELECT COUNT(*)::int AS count
      FROM mcp_request_logs
      WHERE client_id = ${client.id}
        AND created_at >= NOW() - INTERVAL '1 minute'
    `);
    const count = Number(result.rows[0]?.count ?? 0);
    if (count >= client.rateLimitPerMinute) {
      return { allowed: false, errorCode: 'MCP_RATE_LIMITED', window: 'minute', limit: client.rateLimitPerMinute, count };
    }
  }

  if (client.rateLimitPerDay && client.rateLimitPerDay > 0) {
    const result = await db.execute(sql`
      SELECT COUNT(*)::int AS count
      FROM mcp_request_logs
      WHERE client_id = ${client.id}
        AND created_at >= NOW() - INTERVAL '1 day'
    `);
    const count = Number(result.rows[0]?.count ?? 0);
    if (count >= client.rateLimitPerDay) {
      return { allowed: false, errorCode: 'MCP_RATE_LIMITED', window: 'day', limit: client.rateLimitPerDay, count };
    }
  }

  return { allowed: true };
}



export async function checkMcpConcurrentCollectLimit(client: Pick<McpClientContext, 'id' | 'concurrentCollectLimit'>): Promise<McpRateLimitResult> {
  if (!client.concurrentCollectLimit || client.concurrentCollectLimit <= 0) return { allowed: true };

  const result = await db.execute(sql`
    SELECT COUNT(*)::int AS count
    FROM collect_jobs
    WHERE client_id = ${client.id}
      AND request_source = 'mcp'
      AND status IN ('pending', 'running')
  `);
  const count = Number(result.rows[0]?.count ?? 0);
  if (count >= client.concurrentCollectLimit) {
    return { allowed: false, errorCode: 'MCP_RATE_LIMITED', window: 'concurrent', limit: client.concurrentCollectLimit, count };
  }

  return { allowed: true };
}

export async function logMcpRequest(input: {
  clientId?: number | null;
  userId?: number | null;
  toolName: string;
  url?: string | null;
  normalizedUrl?: string | null;
  status: 'success' | 'error' | 'rate_limited';
  errorCode?: string | null;
  durationMs?: number | null;
  transport?: string | null;
  clientAgent?: string | null;
  requestMethod?: string | null;
  requestPath?: string | null;
}) {
  await db.insert(mcpRequestLogs).values({
    clientId: input.clientId ?? null,
    userId: input.userId ?? null,
    toolName: input.toolName,
    url: input.url ?? null,
    normalizedUrl: input.normalizedUrl ?? null,
    status: input.status,
    errorCode: input.errorCode ?? null,
    durationMs: input.durationMs ?? null,
    transport: input.transport ?? null,
    clientAgent: input.clientAgent ?? null,
    requestMethod: input.requestMethod ?? null,
    requestPath: input.requestPath ?? null,
  });
}


export async function getMcpPlatformSettings() {
  const [settings] = await db
    .select({
      rateLimitPerMinute: mcpPlatformSettings.rateLimitPerMinute,
      rateLimitPerDay: mcpPlatformSettings.rateLimitPerDay,
      concurrentCollectLimit: mcpPlatformSettings.concurrentCollectLimit,
      updatedAt: mcpPlatformSettings.updatedAt,
    })
    .from(mcpPlatformSettings)
    .where(eq(mcpPlatformSettings.id, 1))
    .limit(1);

  if (!settings) throw new Error('MCP 平台默认配额未初始化');
  return settings;
}

export async function updateMcpPlatformSettings(input: {
  rateLimitPerMinute: number;
  rateLimitPerDay: number;
  concurrentCollectLimit: number;
}) {
  const [settings] = await db
    .update(mcpPlatformSettings)
    .set({
      rateLimitPerMinute: input.rateLimitPerMinute,
      rateLimitPerDay: input.rateLimitPerDay,
      concurrentCollectLimit: input.concurrentCollectLimit,
      updatedAt: new Date(),
    })
    .where(eq(mcpPlatformSettings.id, 1))
    .returning({
      rateLimitPerMinute: mcpPlatformSettings.rateLimitPerMinute,
      rateLimitPerDay: mcpPlatformSettings.rateLimitPerDay,
      concurrentCollectLimit: mcpPlatformSettings.concurrentCollectLimit,
      updatedAt: mcpPlatformSettings.updatedAt,
    });

  if (!settings) throw new Error('MCP 平台默认配额未初始化');
  return settings;
}


export async function createMcpClient(input: {
  name: string;
  ownerUserId: number;
  scopes: string[];
  enabled?: boolean;
  rateLimitPerMinute?: number | null;
  rateLimitPerDay?: number | null;
  concurrentCollectLimit?: number | null;
  defaultSaveToInbox?: boolean;
}) {
  const [owner] = await db
    .select({ id: users.id, username: users.username, status: users.status })
    .from(users)
    .where(eq(users.id, input.ownerUserId))
    .limit(1);
  if (!owner || owner.status !== 'active') return null;

  const apiKey = generateMcpApiKey();
  const apiKeyHash = hashMcpApiKey(apiKey);
  const [client] = await db.insert(mcpClients).values({
    name: input.name,
    ownerUserId: owner.id,
    apiKeyHash,
    scopes: input.scopes,
    enabled: input.enabled ?? true,
    rateLimitPerMinute: input.rateLimitPerMinute ?? null,
    rateLimitPerDay: input.rateLimitPerDay ?? null,
    concurrentCollectLimit: input.concurrentCollectLimit ?? null,
    defaultSaveToInbox: input.defaultSaveToInbox ?? false,
  }).returning({
    id: mcpClients.id,
    name: mcpClients.name,
    ownerUserId: mcpClients.ownerUserId,
    scopes: mcpClients.scopes,
    enabled: mcpClients.enabled,
    rateLimitPerMinute: mcpClients.rateLimitPerMinute,
    rateLimitPerDay: mcpClients.rateLimitPerDay,
    concurrentCollectLimit: mcpClients.concurrentCollectLimit,
    defaultSaveToInbox: mcpClients.defaultSaveToInbox,
    createdAt: mcpClients.createdAt,
    updatedAt: mcpClients.updatedAt,
    lastUsedAt: mcpClients.lastUsedAt,
  });

  return { client: { ...client, ownerUsername: owner.username, ownerStatus: owner.status }, apiKey };
}


export async function listMcpClients(options: { ownerUserId?: number } = {}) {
  let query = db
    .select({
      id: mcpClients.id,
      name: mcpClients.name,
      ownerUserId: mcpClients.ownerUserId,
      ownerUsername: users.username,
      ownerStatus: users.status,
      scopes: mcpClients.scopes,
      enabled: mcpClients.enabled,
      rateLimitPerMinute: mcpClients.rateLimitPerMinute,
      rateLimitPerDay: mcpClients.rateLimitPerDay,
      concurrentCollectLimit: mcpClients.concurrentCollectLimit,
      defaultSaveToInbox: mcpClients.defaultSaveToInbox,
      createdAt: mcpClients.createdAt,
      updatedAt: mcpClients.updatedAt,
      lastUsedAt: mcpClients.lastUsedAt,
    })
    .from(mcpClients)
    .innerJoin(users, eq(mcpClients.ownerUserId, users.id))
    .$dynamic();

  if (options.ownerUserId !== undefined) {
    query = query.where(eq(mcpClients.ownerUserId, options.ownerUserId));
  }

  return query.orderBy(desc(mcpClients.createdAt));
}

export async function updateMcpClient(id: number, updates: {
  enabled?: boolean;
  scopes?: string[];
  rateLimitPerMinute?: number | null;
  rateLimitPerDay?: number | null;
  concurrentCollectLimit?: number | null;
  defaultSaveToInbox?: boolean;
  ownerUserId?: number;
}) {
  const values: Partial<typeof mcpClients.$inferInsert> = { updatedAt: new Date() };
  if (updates.enabled !== undefined) values.enabled = updates.enabled;
  if (updates.scopes !== undefined) values.scopes = updates.scopes;
  if (updates.rateLimitPerMinute !== undefined) values.rateLimitPerMinute = updates.rateLimitPerMinute;
  if (updates.rateLimitPerDay !== undefined) values.rateLimitPerDay = updates.rateLimitPerDay;
  if (updates.concurrentCollectLimit !== undefined) values.concurrentCollectLimit = updates.concurrentCollectLimit;
  if (updates.defaultSaveToInbox !== undefined) values.defaultSaveToInbox = updates.defaultSaveToInbox;

  const [client] = await db
    .update(mcpClients)
    .set(values)
    .where(updates.ownerUserId === undefined ? eq(mcpClients.id, id) : and(eq(mcpClients.id, id), eq(mcpClients.ownerUserId, updates.ownerUserId)))
    .returning({
      id: mcpClients.id,
      name: mcpClients.name,
      ownerUserId: mcpClients.ownerUserId,
      scopes: mcpClients.scopes,
      enabled: mcpClients.enabled,
      rateLimitPerMinute: mcpClients.rateLimitPerMinute,
      rateLimitPerDay: mcpClients.rateLimitPerDay,
      concurrentCollectLimit: mcpClients.concurrentCollectLimit,
      defaultSaveToInbox: mcpClients.defaultSaveToInbox,
      updatedAt: mcpClients.updatedAt,
    });
  return client ?? null;
}

export async function rotateMcpClientApiKey(id: number, ownerUserId?: number) {
  const apiKey = generateMcpApiKey();
  const apiKeyHash = hashMcpApiKey(apiKey);
  const [client] = await db
    .update(mcpClients)
    .set({ apiKeyHash, updatedAt: new Date() })
    .where(ownerUserId === undefined ? eq(mcpClients.id, id) : and(eq(mcpClients.id, id), eq(mcpClients.ownerUserId, ownerUserId)))
    .returning({
      id: mcpClients.id,
      name: mcpClients.name,
      updatedAt: mcpClients.updatedAt,
    });
  if (!client) return null;
  return { client, apiKey };
}

export async function deleteMcpClient(id: number, ownerUserId?: number) {
  const [client] = await db
    .delete(mcpClients)
    .where(ownerUserId === undefined ? eq(mcpClients.id, id) : and(eq(mcpClients.id, id), eq(mcpClients.ownerUserId, ownerUserId)))
    .returning({ id: mcpClients.id, name: mcpClients.name });
  return client ?? null;
}


export async function listMcpRequestLogs(options: { clientId?: number; userId?: number; limit?: number; offset?: number } = {}) {
  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100);
  const offset = Math.max(options.offset ?? 0, 0);
  let query = db
    .select({
      id: mcpRequestLogs.id,
      clientId: mcpRequestLogs.clientId,
      userId: mcpRequestLogs.userId,
      toolName: mcpRequestLogs.toolName,
      url: mcpRequestLogs.url,
      normalizedUrl: mcpRequestLogs.normalizedUrl,
      status: mcpRequestLogs.status,
      errorCode: mcpRequestLogs.errorCode,
      durationMs: mcpRequestLogs.durationMs,
      createdAt: mcpRequestLogs.createdAt,
    })
    .from(mcpRequestLogs)
    .$dynamic();

  if (options.clientId !== undefined) {
    query = query.where(eq(mcpRequestLogs.clientId, options.clientId));
  } else if (options.userId !== undefined) {
    query = query.where(eq(mcpRequestLogs.userId, options.userId));
  }

  return query.orderBy(desc(mcpRequestLogs.createdAt)).limit(limit).offset(offset);
}

/** MCP 请求日志保留天数，超过则定期清理 */
const MCP_LOG_RETENTION_DAYS = 30;

/**
 * 清理过期的 MCP 请求日志。
 * mcp_request_logs 无限增长会拖慢限流 COUNT 查询，需定期清理。
 */
export async function cleanExpiredMcpRequestLogs(): Promise<number> {
  const result = await db.execute(sql`
    DELETE FROM mcp_request_logs
    WHERE created_at < NOW() - make_interval(days => ${MCP_LOG_RETENTION_DAYS})
  `);
  return result.rowCount ?? 0;
}

/**
 * 启动 MCP 日志定时清理：启动时清理一次，之后每 24 小时清理一次。
 */
export function startMcpLogCleanupScheduler(): NodeJS.Timeout {
  cleanExpiredMcpRequestLogs()
    .then((n) => { if (n > 0) console.log(`[mcp-log] 启动清理 ${n} 条过期日志`); })
    .catch((e) => console.error('[mcp-log] 启动清理失败:', e.message));
  return setInterval(() => {
    cleanExpiredMcpRequestLogs()
      .then((n) => { if (n > 0) console.log(`[mcp-log] 定时清理 ${n} 条过期日志`); })
      .catch((e) => console.error('[mcp-log] 定时清理失败:', e.message));
  }, 24 * 60 * 60 * 1000);
}
