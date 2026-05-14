import { Context, Next } from 'hono';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const jwt = require('jsonwebtoken');
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';

const JWT_SECRET = process.env.JWT_SECRET || 'storing-jwt-secret-key';

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
  const authHeader = c.req.header('Authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!token) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: '请先登录' } }, 401);
  }

  const userId = verifyToken(token);
  if (!userId) {
    return c.json({ error: { code: 'INVALID_TOKEN', message: 'Token 无效或已过期' } }, 401);
  }

  const [user] = await db
    .select({ id: users.id, username: users.username })
    .from(users)
    .where(eq(users.id, userId));

  if (!user) {
    return c.json({ error: { code: 'INVALID_TOKEN', message: 'Token 无效或已过期' } }, 401);
  }

  c.set('user', user);
  await next();
}

/**
 * 可选登录的中间件
 * 提取用户信息但不强制要求登录
 */
export async function optionalAuth(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (token) {
    const userId = verifyToken(token);
    if (userId) {
      const [user] = await db
        .select({ id: users.id, username: users.username })
        .from(users)
        .where(eq(users.id, userId));
      if (user) c.set('user', user);
    }
  }

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