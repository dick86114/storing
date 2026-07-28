import { createHash, randomBytes, randomUUID } from 'crypto';
import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { mobileSessions } from '../db/schema.js';

const REFRESH_TOKEN_BYTES = 32;
const REFRESH_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000;
const DEVICE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type MobileDevice = {
  deviceId: string;
  deviceName: string;
  appVersion: string;
};

export type ClientSessionType = 'android' | 'browser_extension';

export type MobileSessionSummary = {
  id: string;
  deviceId: string;
  deviceName: string;
  appVersion: string;
  clientType: ClientSessionType;
  createdAt: Date | null;
  lastUsedAt: Date | null;
  expiresAt: Date;
  revokedAt: Date | null;
};

export function createMobileRefreshToken() {
  return randomBytes(REFRESH_TOKEN_BYTES).toString('base64url');
}

export function hashMobileRefreshToken(refreshToken: string) {
  return createHash('sha256').update(refreshToken, 'utf8').digest('hex');
}

export function validateMobileDevice(input: unknown): MobileDevice {
  const candidate = input as Partial<MobileDevice> | null;
  const deviceId = typeof candidate?.deviceId === 'string' ? candidate.deviceId.trim() : '';
  const deviceName = typeof candidate?.deviceName === 'string' ? candidate.deviceName.trim() : '';
  const appVersion = typeof candidate?.appVersion === 'string' ? candidate.appVersion.trim() : '';

  if (!DEVICE_ID_PATTERN.test(deviceId)) throw new Error('设备标识无效');
  if (!deviceName || deviceName.length > 128) throw new Error('设备名称无效');
  if (!appVersion || appVersion.length > 64) throw new Error('应用版本无效');

  return { deviceId, deviceName, appVersion };
}

export async function initMobileSessionSchema() {
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS mobile_sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      device_id TEXT NOT NULL,
      device_name TEXT NOT NULL,
      refresh_token_hash TEXT NOT NULL UNIQUE,
      app_version TEXT NOT NULL,
      client_type TEXT NOT NULL DEFAULT 'android',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      last_used_at TIMESTAMP NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMP NOT NULL,
      revoked_at TIMESTAMP
    )
  `));
  await db.execute(sql.raw(`ALTER TABLE mobile_sessions ADD COLUMN IF NOT EXISTS client_type TEXT NOT NULL DEFAULT 'android'`));
  await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS mobile_sessions_user_active_idx ON mobile_sessions(user_id, last_used_at DESC) WHERE revoked_at IS NULL`));
  await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS mobile_sessions_expiry_idx ON mobile_sessions(expires_at) WHERE revoked_at IS NULL`));
}

function createSessionId() {
  return randomUUID();
}

function asSummary(row: typeof mobileSessions.$inferSelect): MobileSessionSummary {
  return {
    id: row.id,
    deviceId: row.deviceId,
    deviceName: row.deviceName,
    appVersion: row.appVersion,
    clientType: row.clientType as ClientSessionType,
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt,
  };
}

export async function createMobileSession(input: { userId: number; device: MobileDevice; clientType?: ClientSessionType }) {
  const refreshToken = createMobileRefreshToken();
  const now = new Date();
  const expiresAt = new Date(now.getTime() + REFRESH_TOKEN_TTL_MS);
  const [session] = await db.insert(mobileSessions).values({
    id: createSessionId(),
    userId: input.userId,
    deviceId: input.device.deviceId,
    deviceName: input.device.deviceName,
    refreshTokenHash: hashMobileRefreshToken(refreshToken),
    appVersion: input.device.appVersion,
    clientType: input.clientType ?? 'android',
    createdAt: now,
    lastUsedAt: now,
    expiresAt,
  }).returning();

  return { refreshToken, session: asSummary(session) };
}

export async function rotateMobileSession(refreshToken: string, device?: MobileDevice, clientType?: ClientSessionType) {
  const currentHash = hashMobileRefreshToken(refreshToken);
  const now = new Date();
  const [current] = await db
    .select()
    .from(mobileSessions)
    .where(and(
      eq(mobileSessions.refreshTokenHash, currentHash),
      isNull(mobileSessions.revokedAt),
      gt(mobileSessions.expiresAt, now),
    ))
    .limit(1);

  if (!current || (clientType && current.clientType !== clientType)) return null;

  const nextRefreshToken = createMobileRefreshToken();
  const expiresAt = new Date(now.getTime() + REFRESH_TOKEN_TTL_MS);
  const values: Partial<typeof mobileSessions.$inferInsert> = {
    refreshTokenHash: hashMobileRefreshToken(nextRefreshToken),
    lastUsedAt: now,
    expiresAt,
  };
  if (device) {
    values.deviceId = device.deviceId;
    values.deviceName = device.deviceName;
    values.appVersion = device.appVersion;
  }

  const [updated] = await db
    .update(mobileSessions)
    .set(values)
    .where(and(
      eq(mobileSessions.id, current.id),
      eq(mobileSessions.refreshTokenHash, currentHash),
      isNull(mobileSessions.revokedAt),
    ))
    .returning();

  if (!updated) return null;
  return { refreshToken: nextRefreshToken, session: asSummary(updated), userId: updated.userId };
}

export async function revokeMobileSession(sessionId: string, userId: number, clientType?: ClientSessionType) {
  const [revoked] = await db
    .update(mobileSessions)
    .set({ revokedAt: new Date() })
    .where(and(
      eq(mobileSessions.id, sessionId),
      eq(mobileSessions.userId, userId),
      isNull(mobileSessions.revokedAt),
      ...(clientType ? [eq(mobileSessions.clientType, clientType)] : []),
    ))
    .returning({ id: mobileSessions.id });
  return Boolean(revoked);
}

export async function revokeMobileSessionByRefreshToken(refreshToken: string, clientType?: ClientSessionType) {
  const [revoked] = await db
    .update(mobileSessions)
    .set({ revokedAt: new Date() })
    .where(and(
      eq(mobileSessions.refreshTokenHash, hashMobileRefreshToken(refreshToken)),
      isNull(mobileSessions.revokedAt),
      ...(clientType ? [eq(mobileSessions.clientType, clientType)] : []),
    ))
    .returning({ id: mobileSessions.id });
  return Boolean(revoked);
}

export async function revokeMobileSessionsForUser(userId: number, clientType?: ClientSessionType) {
  await db
    .update(mobileSessions)
    .set({ revokedAt: new Date() })
    .where(and(
      eq(mobileSessions.userId, userId),
      isNull(mobileSessions.revokedAt),
      ...(clientType ? [eq(mobileSessions.clientType, clientType)] : []),
    ));
}

export async function listMobileSessions(userId: number, clientType?: ClientSessionType) {
  const rows = await db
    .select()
    .from(mobileSessions)
    .where(and(
      eq(mobileSessions.userId, userId),
      ...(clientType ? [eq(mobileSessions.clientType, clientType)] : []),
    ))
    .orderBy(desc(mobileSessions.lastUsedAt));
  return rows.map(asSummary);
}
