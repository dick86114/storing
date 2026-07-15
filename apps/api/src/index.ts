import './env.js';
import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { articlesRoutes } from './routes/articles.js';
import { searchRoutes } from './routes/search.js';
import { healthRoutes } from './routes/health.js';
import { authRoutes } from './routes/auth.js';
import { wikiRoutes } from './routes/wiki.js';
import { collectRoutes } from './routes/collect.js';
import { mcpRoutes } from './routes/mcp.js';
import { db } from './db/index.js';
import { users } from './db/schema.js';
import { initWikiSchema } from './services/wiki.service.js';
import { startWikiWorker } from './services/wiki.worker.js';
import { initCollectSchema } from './services/collect.service.js';
import { initMcpSchema } from './services/mcp-auth.service.js';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcrypt';

const app = new Hono();

app.use('*', logger());
app.use('*', cors({ origin: 'http://localhost:1050' }));

app.route('/api/v1', healthRoutes);
app.route('/api/v1', authRoutes);
app.route('/api/v1', articlesRoutes);
app.route('/api/v1', searchRoutes);
app.route('/api/v1', wikiRoutes);
app.route('/api/v1', collectRoutes);
app.route('/api/v1', mcpRoutes);

app.onError((err, c) => {
  console.error(err);
  return c.json({ error: { code: 'INTERNAL_ERROR', message: err.message } }, 500);
});

/**
 * 初始化管理员账号
 */
async function initAdmin() {
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

  try {
    // 检查管理员是否存在
    const [existing] = await db
      .select()
      .from(users)
      .where(eq(users.username, adminUsername));

    if (!existing) {
      // 创建管理员
      const passwordHash = await bcrypt.hash(adminPassword, 10);
      await db.insert(users).values({
        username: adminUsername,
        passwordHash,
        role: 'admin',
        status: 'active',
      });
      console.log(`管理员账号已创建: ${adminUsername}`);
    } else {
      await db.update(users).set({ role: 'admin', status: 'active', updatedAt: new Date() }).where(eq(users.id, existing.id));
      console.log(`管理员账号已存在: ${adminUsername}`);
    }
  } catch (err) {
    console.error('初始化管理员失败:', err);
  }
}

// 启动服务
async function startServer() {
  await initMcpSchema().catch((err) => console.error('初始化 MCP 表失败:', err));
  await initAdmin();
  await initCollectSchema().catch((err) => console.error('初始化采集表失败:', err));
  await initWikiSchema().catch((err) => console.error('初始化 Wiki 表失败:', err));
  startWikiWorker();
  serve({ fetch: app.fetch, port: 1052 }, (info) => {
    console.log(`API server running on http://localhost:${info.port}`);
  });
}

startServer().catch((err) => {
  console.error('API 服务启动失败:', err);
  process.exit(1);
});
