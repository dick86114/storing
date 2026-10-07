import { createRequire } from 'module';
import { randomBytes, randomUUID } from 'crypto';
import { and, eq, gt, isNull, lt, or } from 'drizzle-orm';
const require = createRequire(import.meta.url);
const jwt = require('jsonwebtoken');
import { db } from '../db/index.js';
import { mobileSessions, users } from '../db/schema.js';
import {
  calculateSessionWindows,
  createMobileSession,
  hashMobileRefreshToken,
  revokeMobileSession,
  SESSION_IDLE_TTL_MS,
  buildMobileSessionRotation,
  canRecoverRotatedRefreshToken,
  type MobileSessionSummary,
} from './mobile-session.service.js';
import { logAuthEvent } from './auth-telemetry.service.js';

const WEB_SESSION_SECRET_BYTES = 32;
const WEB_SESSION_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type WebSessionCookie = { sessionId: string; secret: string };
export type WebSessionUser = Pick<typeof users.$inferSelect, 'id' | 'username' | 'role' | 'status'>;

export function getRequiredJwtSecret() {
  const configured = process.env.JWT_SECRET?.trim();
  if (configured && configured.length >= 32) return configured;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be configured with at least 32 characters in production');
  }
  return randomBytes(32).toString('hex');
}

export function formatWebSessionCookie(sessionId: string, secret: string) {
  return `${sessionId}.${secret}`;
}

export function parseWebSessionCookie(raw: string | undefined): WebSessionCookie | null {
  if (!raw || raw.length > 256) return null;
  const separator = raw.lastIndexOf('.');
  if (separator <= 0) return null;
  const sessionId = raw.slice(0, separator);
  const secret = raw.slice(separator + 1);
  if (!WEB_SESSION_ID_PATTERN.test(sessionId) || secret.length !== 43) return null;
  return { sessionId, secret };
}

function createWebSessionSecret() {
  return randomBytes(WEB_SESSION_SECRET_BYTES).toString('base64url');
}

export async function createWebSession(userId: number) {
  const sessionId = randomUUID();
  const cookieSecret = createWebSessionSecret();
  const { session } = await createMobileSession({
    userId,
    sessionId,
    clientType: 'web',
    device: {
      deviceId: sessionId,
      deviceName: 'Web 浏览器',
      appVersion: 'web',
    },
  });

  logAuthEvent({ userId, sessionId, clientType: 'web', event: 'web_session_created' });
  return { session, cookieSecret };
}

export async function verifyWebSessionCookie(raw: string | undefined) {
  const cookie = parseWebSessionCookie(raw);
  if (!cookie) return null;

  const now = new Date();
  const presentedHash = hashMobileRefreshToken(cookie.secret);

  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ session: mobileSessions, user: users })
      .from(mobileSessions)
      .innerJoin(users, eq(users.id, mobileSessions.userId))
      .where(and(
        eq(mobileSessions.id, cookie.sessionId),
        eq(mobileSessions.clientType, 'web'),
        isNull(mobileSessions.revokedAt),
        gt(mobileSessions.expiresAt, now),
        gt(mobileSessions.absoluteExpiresAt, now),
        or(
          eq(mobileSessions.refreshTokenHash, presentedHash),
          and(
            eq(mobileSessions.previousRefreshTokenHash, presentedHash),
            gt(mobileSessions.rotationGraceUntil, now),
            lt(mobileSessions.rotationCount, 3),
          ),
        ),
      ))
      .limit(1);

    if (!row || row.user.status !== 'active') return null;

    const remaining = row.session.expiresAt.getTime() - now.getTime();
    const recovery = row.session.previousRefreshTokenHash === presentedHash;
    const shouldRotate = recovery || remaining <= SESSION_IDLE_TTL_MS / 2;

    if (shouldRotate) {
      const cookieSecret = createWebSessionSecret();
      const rotation = buildMobileSessionRotation({
        session: row.session,
        presentedTokenHash: presentedHash,
        nextTokenHash: hashMobileRefreshToken(cookieSecret),
        now,
        recovery,
      });

      const [updated] = await tx
        .update(mobileSessions)
        .set(rotation.values)
        .where(and(
          eq(mobileSessions.id, row.session.id),
          recovery
            ? eq(mobileSessions.previousRefreshTokenHash, presentedHash)
            : eq(mobileSessions.refreshTokenHash, presentedHash),
          isNull(mobileSessions.revokedAt),
        ))
        .returning();
      if (!updated) return null;

      return {
        user: {
          id: row.user.id,
          username: row.user.username,
          role: row.user.role,
          status: row.user.status,
        },
        session: updated as MobileSessionSummary,
        rotatedCookieSecret: cookieSecret,
      };
    }

    const windows = calculateSessionWindows(now, now);
    const [updated] = await tx
      .update(mobileSessions)
      .set({
        lastUsedAt: now,
        expiresAt: windows.expiresAt > row.session.absoluteExpiresAt
          ? row.session.absoluteExpiresAt
          : windows.expiresAt,
      })
      .where(and(
        eq(mobileSessions.id, row.session.id),
        eq(mobileSessions.refreshTokenHash, presentedHash),
        isNull(mobileSessions.revokedAt),
      ))
      .returning();
    if (!updated) return null;

    return {
      user: {
        id: row.user.id,
        username: row.user.username,
        role: row.user.role,
        status: row.user.status,
      },
      session: updated as MobileSessionSummary,
    };
  });
}

export async function revokeWebSessionByCookie(raw: string | undefined) {
  const cookie = parseWebSessionCookie(raw);
  if (!cookie) return false;
  const [session] = await db
    .select({ userId: mobileSessions.userId })
    .from(mobileSessions)
    .where(and(
      eq(mobileSessions.id, cookie.sessionId),
      eq(mobileSessions.clientType, 'web'),
      isNull(mobileSessions.revokedAt),
    ))
    .limit(1);
  if (!session) return false;
  return revokeMobileSession(cookie.sessionId, session.userId, 'web');
}

export async function upgradeLegacyWebJwt(token: string) {
  let userId: number;
  try {
    const payload = jwt.verify(token, getRequiredJwtSecret()) as { userId?: number };
    if (!payload?.userId) return null;
    userId = payload.userId;
  } catch {
    return null;
  }

  const [user] = await db
    .select({ id: users.id, username: users.username, role: users.role, status: users.status })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user || user.status !== 'active') return null;

  const created = await createWebSession(user.id);
  return created;
}
