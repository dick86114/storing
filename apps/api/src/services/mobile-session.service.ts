import { createHash, randomBytes, randomUUID } from 'crypto';
import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { mobileSessions } from '../db/schema.js';
import { logAuthEvent } from './auth-telemetry.service.js';

const REFRESH_TOKEN_BYTES = 32;
export const SESSION_IDLE_TTL_MS = 90 * 24 * 60 * 60 * 1000;
export const SESSION_ABSOLUTE_TTL_MS = 365 * 24 * 60 * 60 * 1000;
export const REFRESH_ROTATION_GRACE_MS = 60 * 1000;
export const MAX_REFRESH_ROTATION_RECOVERIES = 3;
const DEVICE_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type MobileDevice = {
  deviceId: string;
  deviceName: string;
  appVersion: string;
};

export type ClientSessionType = 'android' | 'browser_extension' | 'macos' | 'web';

export type MobileSessionSummary = {
  id: string;
  userId: number;
  deviceId: string;
  deviceName: string;
  appVersion: string;
  clientType: ClientSessionType;
  createdAt: Date | null;
  lastUsedAt: Date | null;
  expiresAt: Date;
  absoluteExpiresAt: Date;
  rotationGraceUntil: Date | null;
  rotationCount: number;
  revokedAt: Date | null;
};

export type MobileSessionRotation = {
  refreshToken: string;
  session: MobileSessionSummary;
  userId: number;
  recoveredByRotationGrace: boolean;
};

export function calculateSessionWindows(now: Date, createdAt: Date) {
  return {
    expiresAt: new Date(now.getTime() + SESSION_IDLE_TTL_MS),
    absoluteExpiresAt: new Date(createdAt.getTime() + SESSION_ABSOLUTE_TTL_MS),
  };
}

export function canRecoverRotatedRefreshToken(
  session: Pick<MobileSessionSummary, 'revokedAt' | 'rotationGraceUntil' | 'rotationCount'>,
  now: Date,
) {
  return session.revokedAt === null
    && session.rotationGraceUntil !== null
    && session.rotationGraceUntil > now
    && session.rotationCount < MAX_REFRESH_ROTATION_RECOVERIES;
}

export function buildMobileSessionRotation(input: {
  session: Pick<MobileSessionSummary, 'createdAt' | 'absoluteExpiresAt' | 'rotationCount'>;
  presentedTokenHash: string;
  nextTokenHash: string;
  now: Date;
  recovery: boolean;
}) {
  const windows = calculateSessionWindows(input.now, input.session.createdAt ?? input.now);
  const absoluteExpiresAt = input.session.absoluteExpiresAt > windows.absoluteExpiresAt
    ? input.session.absoluteExpiresAt
    : windows.absoluteExpiresAt;

  return {
    recoveredByRotationGrace: input.recovery,
    values: {
      refreshTokenHash: input.nextTokenHash,
      previousRefreshTokenHash: input.presentedTokenHash,
      rotationGraceUntil: new Date(input.now.getTime() + REFRESH_ROTATION_GRACE_MS),
      rotationCount: input.recovery ? input.session.rotationCount + 1 : 0,
      lastUsedAt: input.now,
      expiresAt: absoluteExpiresAt > windows.expiresAt ? windows.expiresAt : absoluteExpiresAt,
      absoluteExpiresAt,
    },
  };
}

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
      absolute_expires_at TIMESTAMP NOT NULL,
      previous_refresh_token_hash TEXT,
      rotation_grace_until TIMESTAMP,
      rotation_count INTEGER NOT NULL DEFAULT 0,
      revoked_at TIMESTAMP
    )
  `));
  await db.execute(sql.raw(`ALTER TABLE mobile_sessions ADD COLUMN IF NOT EXISTS client_type TEXT NOT NULL DEFAULT 'android'`));
  await db.execute(sql.raw(`ALTER TABLE mobile_sessions ADD COLUMN IF NOT EXISTS absolute_expires_at TIMESTAMP`));
  await db.execute(sql.raw(`UPDATE mobile_sessions SET absolute_expires_at = COALESCE(created_at, expires_at, NOW()) + INTERVAL '365 days' WHERE absolute_expires_at IS NULL`));
  await db.execute(sql.raw(`ALTER TABLE mobile_sessions ALTER COLUMN absolute_expires_at SET NOT NULL`));
  await db.execute(sql.raw(`ALTER TABLE mobile_sessions ADD COLUMN IF NOT EXISTS previous_refresh_token_hash TEXT`));
  await db.execute(sql.raw(`ALTER TABLE mobile_sessions ADD COLUMN IF NOT EXISTS rotation_grace_until TIMESTAMP`));
  await db.execute(sql.raw(`ALTER TABLE mobile_sessions ADD COLUMN IF NOT EXISTS rotation_count INTEGER NOT NULL DEFAULT 0`));
  await db.execute(sql.raw(`CREATE UNIQUE INDEX IF NOT EXISTS mobile_sessions_previous_refresh_token_hash_idx ON mobile_sessions(previous_refresh_token_hash)`));
  await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS mobile_sessions_user_active_idx ON mobile_sessions(user_id, last_used_at DESC) WHERE revoked_at IS NULL`));
  await db.execute(sql.raw(`CREATE INDEX IF NOT EXISTS mobile_sessions_expiry_idx ON mobile_sessions(expires_at) WHERE revoked_at IS NULL`));
}

function createSessionId() {
  return randomUUID();
}

function asSummary(row: typeof mobileSessions.$inferSelect): MobileSessionSummary {
  return {
    id: row.id,
    userId: row.userId,
    deviceId: row.deviceId,
    deviceName: row.deviceName,
    appVersion: row.appVersion,
    clientType: row.clientType as ClientSessionType,
    createdAt: row.createdAt,
    lastUsedAt: row.lastUsedAt,
    expiresAt: row.expiresAt,
    absoluteExpiresAt: row.absoluteExpiresAt,
    rotationGraceUntil: row.rotationGraceUntil,
    rotationCount: row.rotationCount,
    revokedAt: row.revokedAt,
  };
}

export async function createMobileSession(input: {
  userId: number;
  device: MobileDevice;
  clientType?: ClientSessionType;
  sessionId?: string;
  credentialHash?: string;
}) {
  const refreshToken = createMobileRefreshToken();
  const now = new Date();
  const windows = calculateSessionWindows(now, now);
  const [session] = await db.insert(mobileSessions).values({
    id: input.sessionId ?? createSessionId(),
    userId: input.userId,
    deviceId: input.device.deviceId,
    deviceName: input.device.deviceName,
    refreshTokenHash: input.credentialHash ?? hashMobileRefreshToken(refreshToken),
    appVersion: input.device.appVersion,
    clientType: input.clientType ?? 'android',
    createdAt: now,
    lastUsedAt: now,
    ...windows,
  }).returning();

  return { refreshToken: input.credentialHash ? '' : refreshToken, session: asSummary(session) };
}

export async function rotateMobileSession(
  refreshToken: string,
  device?: MobileDevice,
  clientType?: ClientSessionType,
): Promise<MobileSessionRotation | null> {
  const currentHash = hashMobileRefreshToken(refreshToken);
  const now = new Date();

  return db.transaction(async (tx) => {
    const selectValidSession = async (
      hashColumn: typeof mobileSessions.refreshTokenHash | typeof mobileSessions.previousRefreshTokenHash,
    ) => {
      const [session] = await tx
        .select()
        .from(mobileSessions)
        .where(and(
          eq(hashColumn, currentHash),
          isNull(mobileSessions.revokedAt),
          gt(mobileSessions.expiresAt, now),
        ))
        .limit(1);
      return session;
    };

    const current = await selectValidSession(mobileSessions.refreshTokenHash);
    let recovery = false;
    let session = current;

    if (!session) {
      const previous = await selectValidSession(mobileSessions.previousRefreshTokenHash);
      if (!previous || !canRecoverRotatedRefreshToken(previous, now)) return null;
      session = previous;
      recovery = true;
    }

    if (clientType && session.clientType !== clientType) return null;

    const nextRefreshToken = createMobileRefreshToken();
    const rotation = buildMobileSessionRotation({
      session,
      presentedTokenHash: currentHash,
      nextTokenHash: hashMobileRefreshToken(nextRefreshToken),
      now,
      recovery,
    });

    if (device) {
      Object.assign(rotation.values, {
        deviceId: device.deviceId,
        deviceName: device.deviceName,
        appVersion: device.appVersion,
      });
    }

    const [updated] = await tx
      .update(mobileSessions)
      .set(rotation.values)
      .where(and(
        eq(mobileSessions.id, session.id),
        recovery
          ? eq(mobileSessions.previousRefreshTokenHash, currentHash)
          : eq(mobileSessions.refreshTokenHash, currentHash),
        isNull(mobileSessions.revokedAt),
      ))
      .returning();

    if (!updated) return null;
    logAuthEvent({
      userId: updated.userId,
      sessionId: updated.id,
      clientType: updated.clientType,
      event: recovery ? 'refresh_rotation_recovered' : 'refresh_rotation',
    });

    return {
      refreshToken: nextRefreshToken,
      session: asSummary(updated),
      userId: updated.userId,
      recoveredByRotationGrace: recovery,
    };
  });
}

export async function migrateLegacyMacSession(
  refreshToken: string,
  device?: MobileDevice,
): Promise<MobileSessionRotation | null> {
  const currentHash = hashMobileRefreshToken(refreshToken);
  const now = new Date();

  return db.transaction(async (tx) => {
    const [session] = await tx
      .select()
      .from(mobileSessions)
      .where(and(
        eq(mobileSessions.refreshTokenHash, currentHash),
        eq(mobileSessions.clientType, 'android'),
        isNull(mobileSessions.revokedAt),
        gt(mobileSessions.expiresAt, now),
      ))
      .limit(1);
    if (!session) return null;

    const nextRefreshToken = createMobileRefreshToken();
    const rotation = buildMobileSessionRotation({
      session,
      presentedTokenHash: currentHash,
      nextTokenHash: hashMobileRefreshToken(nextRefreshToken),
      now,
      recovery: false,
    });
    const values: Partial<typeof mobileSessions.$inferInsert> = {
      ...rotation.values,
      clientType: 'macos' as const,
    };
    if (device) {
      values.deviceId = device.deviceId;
      values.deviceName = device.deviceName;
      values.appVersion = device.appVersion;
    }

    const [updated] = await tx
      .update(mobileSessions)
      .set(values)
      .where(and(
        eq(mobileSessions.id, session.id),
        eq(mobileSessions.refreshTokenHash, currentHash),
        eq(mobileSessions.clientType, 'android'),
        isNull(mobileSessions.revokedAt),
      ))
      .returning();
    if (!updated) return null;

    logAuthEvent({
      userId: updated.userId,
      sessionId: updated.id,
      clientType: 'macos',
      event: 'macos_legacy_session_migrated',
    });

    return {
      refreshToken: nextRefreshToken,
      session: asSummary(updated),
      userId: updated.userId,
      recoveredByRotationGrace: false,
    };
  });
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
