import { Hono } from 'hono';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { requireAuth, getCurrentUser, generateToken } from '../middleware/auth.js';

export const authRoutes = new Hono();

/**
 * 登录
 * POST /auth/login
 */
authRoutes.post('/login', async (c) => {
  try {
    const body = await c.req.json();
    const { username, password } = body;

    if (!username || !password) {
      return c.json({ error: { code: 'MISSING_FIELDS', message: '请输入用户名和密码' } }, 400);
    }

    // 查找用户
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.username, username));

    if (!user) {
      return c.json({ error: { code: 'INVALID_CREDENTIALS', message: '用户名或密码错误' } }, 401);
    }

    // 验证密码
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return c.json({ error: { code: 'INVALID_CREDENTIALS', message: '用户名或密码错误' } }, 401);
    }

    // 生成 token
    const token = generateToken(user.id);

    return c.json({
      token,
      user: {
        id: user.id,
        username: user.username,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    return c.json({ error: { code: 'LOGIN_ERROR', message: '登录失败' } }, 500);
  }
});

/**
 * 验证 token
 * GET /auth/verify
 */
authRoutes.get('/verify', requireAuth, async (c) => {
  const user = getCurrentUser(c);
  return c.json({ valid: true, user });
});

/**
 * 获取当前用户信息
 * GET /auth/me
 */
authRoutes.get('/me', requireAuth, async (c) => {
  const user = getCurrentUser(c);
  return c.json({ user });
});

/**
 * 修改密码
 * POST /auth/change-password
 */
authRoutes.post('/change-password', requireAuth, async (c) => {
  try {
    const user = getCurrentUser(c);
    const body = await c.req.json();
    const { currentPassword, newPassword } = body;

    if (!currentPassword || !newPassword) {
      return c.json({ error: { code: 'MISSING_FIELDS', message: '请输入当前密码和新密码' } }, 400);
    }

    if (newPassword.length < 4) {
      return c.json({ error: { code: 'PASSWORD_TOO_SHORT', message: '新密码至少需要 4 个字符' } }, 400);
    }

    // 获取用户完整信息
    const [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, user.id));

    if (!dbUser) {
      return c.json({ error: { code: 'USER_NOT_FOUND', message: '用户不存在' } }, 404);
    }

    // 验证当前密码
    const valid = await bcrypt.compare(currentPassword, dbUser.passwordHash);
    if (!valid) {
      return c.json({ error: { code: 'INVALID_PASSWORD', message: '当前密码错误' } }, 401);
    }

    // 更新密码
    const newPasswordHash = await bcrypt.hash(newPassword, 10);
    await db
      .update(users)
      .set({ passwordHash: newPasswordHash, updatedAt: new Date() })
      .where(eq(users.id, user.id));

    return c.json({ message: '密码已更新' });
  } catch (err) {
    console.error('Change password error:', err);
    return c.json({ error: { code: 'CHANGE_PASSWORD_ERROR', message: '修改密码失败' } }, 500);
  }
});

/**
 * 登出（客户端清除 token 即可）
 * POST /auth/logout
 */
authRoutes.post('/logout', async (c) => {
  return c.json({ message: '已登出' });
});