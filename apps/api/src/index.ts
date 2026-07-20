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
import { initWikiSchema } from './services/wiki.service.js';
import { startWikiWorker } from './services/wiki.worker.js';
import { initCollectSchema, resumePendingWebCollectJobs } from './services/collect.service.js';
import { initMcpSchema } from './services/mcp-auth.service.js';
import { ensurePrivateLibraryPublicationSchema, ensureWikiUserScopeSchema, initArticleMetadataUserScope, repairCollectedArticleMetadataOwnership } from './services/metadata-scope.service.js';
import { ensureConfiguredAdmin, initUserManagementSchema } from './services/admin-bootstrap.service.js';

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

// 启动服务
async function startServer() {
  await initMcpSchema().catch((err) => console.error('初始化 MCP 表失败:', err));
  await initUserManagementSchema().catch((err) => console.error('初始化用户管理字段失败:', err));
  const admin = await ensureConfiguredAdmin();
  console.log(admin.created ? `管理员账号已创建: ${admin.user.username}` : `管理员账号已就绪: ${admin.user.username}`);
  await initArticleMetadataUserScope().catch((err) => console.error('初始化用户级文章元数据失败:', err));
  await ensurePrivateLibraryPublicationSchema().catch((err) => console.error('初始化文章发布字段失败:', err));
  await ensureWikiUserScopeSchema().catch((err) => console.error('初始化 Wiki 用户作用域失败:', err));
  await initCollectSchema().catch((err) => console.error('初始化采集表失败:', err));
  await repairCollectedArticleMetadataOwnership().catch((err) => console.error('修复采集文章归属失败:', err));
  await resumePendingWebCollectJobs().catch((err) => console.error('恢复网页采集队列失败:', err));
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
