import { Context, Next } from 'hono';
import { createRequire } from 'module';
import { randomBytes } from 'crypto';
import { getCookie } from 'hono/cookie';
const require = createRequire(import.meta.url);
const jwt = require('jsonwebtoken');
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';

export function getRequiredJwtSecret() {
  const configured = process.env.JWT_SECRET?.trim();
  if (configured && configured.length >= 32) return configured;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('JWT_SECRET must be configured with at least 32 characters in production');
  }
  return randomBytes(32).toString('hex');
}

const JWT_SECRET = getRequiredJwtSecret();

function getRequestToken(c: Context) {
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) return authHeader.slice('Bearer '.length).trim();
  return getCookie(c, 'storing_token');
}

function cookieAuthAllowedOrigins() {
  return (process.env.APP_ORIGIN || 'http://localhost:1050')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}

export async function requireCsrfProtection(c: Context, next: Next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(c.req.method)) return next();
  if (c.req.header('Authorization')?.startsWith('Bearer ')) return next();
  if (!getCookie(c, 'storing_token')) return next();

  const origin = c.req.header('Origin');
  const fetchSite = c.req.header('Sec-Fetch-Site');
  const originAllowed = Boolean(origin && cookieAuthAllowedOrigins().includes(origin));
  // Browsers protect Sec-Fetch-* headers from script modification. Accept an
  // explicitly same-origin navigation even when a reverse-proxy deployment did
  // not inject APP_ORIGIN into the container, while still rejecting cross-site
  // cookie-authenticated writes.
  const sameOriginBrowserRequest = fetchSite === 'same-origin';
  if (!(originAllowed || sameOriginBrowserRequest)) {
    return c.json({ error: { code: 'CSRF_FORBIDDEN', message: '请求来源无效' } }, 403);
  }
  await next();
}

/**
 * 验证 JWT token 并返回用户信息
 */
function verifyToken(token: string) {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { userId: number };
    if (!payload || !payload.userId) return null;
    return payload.userId;
  } catch {
    return null;
  }
}

/**
 * 必须登录的中间件
 */
export async function requireAuth(c: Context, next: Next) {
  const token = getRequestToken(c);

  if (!token) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: '请先登录' } }, 401);
  }

  const userId = verifyToken(token);
  if (!userId) {
    return c.json({ error: { code: 'INVALID_TOKEN', message: 'Token 无效或已过期' } }, 401);
  }

  const [user] = await db
    .select({ id: users.id, username: users.username, role: users.role, status: users.status })
    .from(users)
    .where(eq(users.id, userId));

  if (!user) {
    return c.json({ error: { code: 'INVALID_TOKEN', message: 'Token 无效或已过期' } }, 401);
  }

  if (user.status !== 'active') {
    return c.json({ error: { code: 'USER_DISABLED', message: '用户已禁用' } }, 403);
  }

  c.set('user', user);
  await next();
}

/**
 * 可选登录的中间件
 * 提取用户信息但不强制要求登录
 */
export async function optionalAuth(c: Context, next: Next) {
  const token = getRequestToken(c);

  if (token) {
    const userId = verifyToken(token);
    if (userId) {
      const [user] = await db
        .select({ id: users.id, username: users.username, role: users.role, status: users.status })
        .from(users)
        .where(eq(users.id, userId));
      if (user && user.status === 'active') c.set('user', user);
    }
  }

  await next();
}



/**
 * 必须为管理员的中间件
 */
export async function requireAdmin(c: Context, next: Next) {
  const token = getRequestToken(c);

  if (!token) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: '请先登录' } }, 401);
  }

  const userId = verifyToken(token);
  if (!userId) {
    return c.json({ error: { code: 'INVALID_TOKEN', message: 'Token 无效或已过期' } }, 401);
  }

  const [user] = await db
    .select({ id: users.id, username: users.username, role: users.role, status: users.status })
    .from(users)
    .where(eq(users.id, userId));

  if (!user) {
    return c.json({ error: { code: 'INVALID_TOKEN', message: 'Token 无效或已过期' } }, 401);
  }

  if (user.status !== 'active') {
    return c.json({ error: { code: 'USER_DISABLED', message: '用户已禁用' } }, 403);
  }

  if (user.role !== 'admin') {
    return c.json({ error: { code: 'ADMIN_REQUIRED', message: '需要管理员权限' } }, 403);
  }

  c.set('user', user);
  await next();
}

/**
 * 获取当前登录用户
 */
export function getCurrentUser(c: Context) {
  return c.get('user');
}

/**
 * 检查是否已登录
 */
export function isAuthenticated(c: Context) {
  return !!c.get('user');
}

/**
 * 生成 JWT token
 */
export function generateToken(userId: number) {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}