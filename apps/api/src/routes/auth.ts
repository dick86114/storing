import { Hono } from 'hono';
import { db } from '../db/index.js';
import { adminAuditLogs, articleMetadata, articles, mcpClients, mcpRequestLogs, users } from '../db/schema.js';
import { and, count, desc, eq, gt, ilike, or, sql } from 'drizzle-orm';
import bcrypt from 'bcrypt';
import { z } from 'zod';
import { requireAuth, requireAdmin, getCurrentUser, generateToken } from '../middleware/auth.js';
import { getConfiguredAdminStatus, resetConfiguredAdminPassword } from '../services/admin-bootstrap.service.js';
import { writeAdminAudit } from '../services/admin-audit.service.js';
import { generateSummaryAndTags } from '../services/ai.service.js';

export const authRoutes = new Hono();

const adminCreateUserSchema = z.object({
  username: z.string().trim().min(2, '用户名至少 2 个字符').max(64, '用户名过长'),
  password: z.string().min(4, '密码至少需要 4 个字符'),
  role: z.enum(['admin', 'user', 'service']).default('user'),
  status: z.enum(['active', 'disabled']).default('active'),
});

const adminUpdateUserSchema = z.object({
  username: z.string().trim().min(2, '用户名至少 2 个字符').max(64, '用户名过长').optional(),
  role: z.enum(['admin', 'user', 'service']).optional(),
  status: z.enum(['active', 'disabled']).optional(),
  password: z.string().min(4, '密码至少需要 4 个字符').optional(),
});

const resetConfiguredAdminPasswordSchema = z.object({
  confirm_username: z.string().trim().min(2, '请输入管理员用户名以确认操作'),
});

function timestampToIso(value: unknown) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const raw = String(value);
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}/.test(raw) ? `${raw.replace(' ', 'T')}Z` : raw;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? raw : date.toISOString();
}

function serializeUser(user: any) {
  return {
    id: user.id,
    username: user.username,
    role: user.role,
    status: user.status,
    created_at: timestampToIso(user.createdAt),
    updated_at: timestampToIso(user.updatedAt),
    last_login_at: timestampToIso(user.lastLoginAt),
    mcp_client_count: Number(user.mcpClientCount ?? 0),
    active_mcp_client_count: Number(user.activeMcpClientCount ?? 0),
    mcp_request_count: Number(user.mcpRequestCount ?? 0),
    last_mcp_used_at: timestampToIso(user.lastMcpUsedAt),
    inbox_count: Number(user.inboxCount ?? 0),
    archive_count: Number(user.archiveCount ?? 0),
    favorite_count: Number(user.favoriteCount ?? 0),
  };
}

async function getAdminTargetUser(targetUserId: number) {
  const [targetUser] = await db
    .select({ id: users.id, username: users.username, role: users.role, status: users.status })
    .from(users)
    .where(eq(users.id, targetUserId))
    .limit(1);
  return targetUser ?? null;
}

function getAdminLibraryViewCondition(view: string) {
  if (view === 'favorites') return eq(articleMetadata.isFavorited, true);
  if (view === 'archive') return eq(articleMetadata.isArchived, true);
  return and(
    sql`COALESCE(${articleMetadata.isArchived}, FALSE) = FALSE`,
    sql`COALESCE(${articleMetadata.isFavorited}, FALSE) = FALSE`,
  );
}

function serializeAdminLibraryArticle(article: any) {
  return {
    id: article.id,
    title: article.title,
    author: article.author,
    source: article.source,
    original_url: article.originalUrl,
    publish_time: timestampToIso(article.publishTime),
    cover_image: article.coverImage,
    source_type: article.sourceType,
    client_id: article.clientId,
    client_name: article.clientName,
    is_favorited: Boolean(article.isFavorited),
    is_archived: Boolean(article.isArchived),
    ai_summary: article.aiSummary,
    created_at: timestampToIso(article.createdAt),
    updated_at: timestampToIso(article.updatedAt),
  };
}

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

    if (user.status !== 'active') {
      return c.json({ error: { code: 'USER_DISABLED', message: '用户已禁用' } }, 403);
    }

    // 验证密码
    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return c.json({ error: { code: 'INVALID_CREDENTIALS', message: '用户名或密码错误' } }, 401);
    }

    await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, user.id));

    // 生成 token
    const token = generateToken(user.id);

    return c.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role,
        status: user.status,
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
/**
 * 管理员：检查启动配置中的管理员账号状态。
 * 不返回密码，仅报告环境密码是否与数据库凭据一致。
 * GET /admin/bootstrap-status
 */
authRoutes.get('/admin/bootstrap-status', requireAdmin, async (c) => {
  const status = await getConfiguredAdminStatus();
  return c.json({
    configured_username: status.configuredUsername,
    account_exists: status.accountExists,
    account_role: status.role,
    account_status: status.status,
    configured_password_matches: status.configuredPasswordMatches,
    updated_at: status.updatedAt,
  });
});

/**
 * 管理员：将启动环境中的 ADMIN_PASSWORD 显式同步到配置管理员账号。
 * POST /admin/bootstrap/reset-password
 */
authRoutes.post('/admin/bootstrap/reset-password', requireAdmin, async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = resetConfiguredAdminPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'BAD_REQUEST', message: parsed.error.errors[0]?.message || '参数错误' } }, 400);
  }

  const current = await getConfiguredAdminStatus();
  if (parsed.data.confirm_username !== current.configuredUsername) {
    return c.json({ error: { code: 'CONFIRMATION_MISMATCH', message: '确认用户名与配置中的管理员不一致' } }, 400);
  }

  const result = await resetConfiguredAdminPassword();
  return c.json({
    message: result.created ? '已创建并同步配置管理员密码' : '已同步配置管理员密码',
    configured_username: result.user.username,
    account_created: result.created,
  });
});

/**
 * 管理员：查看用户列表
 * GET /admin/users
 */
authRoutes.get('/admin/users', requireAdmin, async (c) => {
  // Drizzle renders bare column names inside scalar subqueries. Keep the outer
  // reference qualified so PostgreSQL correlates each aggregate with its user row.
  const parentUserId = sql.raw('"users"."id"');
  const rows = await db
    .select({
      id: users.id,
      username: users.username,
      role: users.role,
      status: users.status,
      createdAt: users.createdAt,
      updatedAt: users.updatedAt,
      lastLoginAt: users.lastLoginAt,
      mcpClientCount: sql<number>`(SELECT COUNT(*)::int FROM ${mcpClients} WHERE ${mcpClients.ownerUserId} = ${parentUserId})`,
      activeMcpClientCount: sql<number>`(SELECT COUNT(*)::int FROM ${mcpClients} WHERE ${mcpClients.ownerUserId} = ${parentUserId} AND ${mcpClients.enabled} = TRUE)`,
      mcpRequestCount: sql<number>`(SELECT COUNT(*)::int FROM ${mcpRequestLogs} WHERE ${mcpRequestLogs.userId} = ${parentUserId})`,
      lastMcpUsedAt: sql<Date | null>`(SELECT MAX(${mcpRequestLogs.createdAt}) FROM ${mcpRequestLogs} WHERE ${mcpRequestLogs.userId} = ${parentUserId})`,
      inboxCount: sql<number>`(SELECT COUNT(*)::int FROM ${articleMetadata} WHERE ${articleMetadata.userId} = ${parentUserId} AND COALESCE(${articleMetadata.isArchived}, FALSE) = FALSE)`,
      archiveCount: sql<number>`(SELECT COUNT(*)::int FROM ${articleMetadata} WHERE ${articleMetadata.userId} = ${parentUserId} AND ${articleMetadata.isArchived} = TRUE)`,
      favoriteCount: sql<number>`(SELECT COUNT(*)::int FROM ${articleMetadata} WHERE ${articleMetadata.userId} = ${parentUserId} AND ${articleMetadata.isFavorited} = TRUE)`,
    })
    .from(users)
    .orderBy(desc(users.createdAt));

  return c.json({ users: rows.map(serializeUser) });
});

/**
 * 管理员：查看某个用户的连接与最近 MCP 调用。
 * GET /admin/users/:id/activity
 */
authRoutes.get('/admin/users/:id/activity', requireAdmin, async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) return c.json({ error: { code: 'BAD_REQUEST', message: '用户 ID 无效' } }, 400);
  const requestedLimit = Number(c.req.query('limit') || 20);
  const limit = Math.max(1, Math.min(Number.isFinite(requestedLimit) ? requestedLimit : 20, 100));
  const offset = Math.max(0, Number(c.req.query('offset') || 0));

  const [account] = await db.select({
    id: users.id,
    username: users.username,
    role: users.role,
    status: users.status,
    lastLoginAt: users.lastLoginAt,
  }).from(users).where(eq(users.id, id)).limit(1);
  if (!account) return c.json({ error: { code: 'USER_NOT_FOUND', message: '用户不存在' } }, 404);

  const clients = await db.select({
    id: mcpClients.id,
    name: mcpClients.name,
    enabled: mcpClients.enabled,
    scopes: mcpClients.scopes,
    createdAt: mcpClients.createdAt,
    lastUsedAt: mcpClients.lastUsedAt,
  }).from(mcpClients).where(eq(mcpClients.ownerUserId, id)).orderBy(desc(mcpClients.lastUsedAt));

  const [logTotal] = await db.select({ count: sql<number>`COUNT(*)::int` }).from(mcpRequestLogs).where(eq(mcpRequestLogs.userId, id));

  const logs = await db.select({
    id: mcpRequestLogs.id,
    clientId: mcpRequestLogs.clientId,
    clientName: mcpClients.name,
    toolName: mcpRequestLogs.toolName,
    status: mcpRequestLogs.status,
    errorCode: mcpRequestLogs.errorCode,
    durationMs: mcpRequestLogs.durationMs,
    transport: mcpRequestLogs.transport,
    clientAgent: mcpRequestLogs.clientAgent,
    requestMethod: mcpRequestLogs.requestMethod,
    requestPath: mcpRequestLogs.requestPath,
    createdAt: mcpRequestLogs.createdAt,
  }).from(mcpRequestLogs)
    .leftJoin(mcpClients, eq(mcpRequestLogs.clientId, mcpClients.id))
    .where(eq(mcpRequestLogs.userId, id))
    .orderBy(desc(mcpRequestLogs.createdAt))
    .limit(limit)
    .offset(offset);

  return c.json({
    user: {
      id: account.id,
      username: account.username,
      role: account.role,
      status: account.status,
      last_login_at: timestampToIso(account.lastLoginAt),
    },
    clients: clients.map((client) => ({
      id: client.id,
      name: client.name,
      enabled: client.enabled,
      scopes: client.scopes,
      created_at: timestampToIso(client.createdAt),
      last_used_at: timestampToIso(client.lastUsedAt),
    })),
    logs_total: Number(logTotal?.count ?? 0),
    limit,
    offset,
    logs: logs.map((log) => ({
      id: log.id,
      client_id: log.clientId,
      client_name: log.clientName ?? null,
      tool_name: log.toolName,
      status: log.status,
      error_code: log.errorCode,
      duration_ms: log.durationMs,
      transport: log.transport ?? 'unknown',
      client_agent: log.clientAgent ?? null,
      request_method: log.requestMethod ?? null,
      request_path: log.requestPath ?? null,
      created_at: timestampToIso(log.createdAt),
    })),
  });
});


/**
 * 管理员：查看一个用户或服务账号的个人文章库。
 * 该接口故意独立于普通 /articles，避免放宽个人收件箱的隔离条件。
 */
authRoutes.get('/admin/users/:id/articles', requireAdmin, async (c) => {
  const targetUserId = Number(c.req.param('id'));
  if (!Number.isFinite(targetUserId)) return c.json({ error: { code: 'BAD_REQUEST', message: '用户 ID 无效' } }, 400);

  const targetUser = await getAdminTargetUser(targetUserId);
  if (!targetUser) return c.json({ error: { code: 'USER_NOT_FOUND', message: '用户不存在' } }, 404);

  const view = c.req.query('view') || 'inbox';
  const query = c.req.query('q')?.trim() || '';
  const collectedSinceRaw = c.req.query('collected_since');
  const collectedSince = collectedSinceRaw ? new Date(collectedSinceRaw) : null;
  if (collectedSinceRaw && (!collectedSince || Number.isNaN(collectedSince.getTime()))) {
    return c.json({ error: { code: 'BAD_REQUEST', message: 'collected_since 无效' } }, 400);
  }
  const requestedPage = Number(c.req.query('page') || 1);
  const requestedPerPage = Number(c.req.query('perPage') || 20);
  const page = Math.max(1, Number.isFinite(requestedPage) ? requestedPage : 1);
  const perPage = Math.max(1, Math.min(Number.isFinite(requestedPerPage) ? requestedPerPage : 20, 100));
  const conditions = [eq(articleMetadata.userId, targetUserId), getAdminLibraryViewCondition(view)];
  if (collectedSince) conditions.push(gt(articleMetadata.createdAt, collectedSince));
  if (query) {
    const pattern = `%${query.replace(/[\\%_]/g, '\\$&')}%`;
    conditions.push(or(ilike(articles.title, pattern), ilike(articles.originalUrl, pattern))!);
  }
  const whereCondition = and(...conditions);

  const [{ total }] = await db
    .select({ total: count() })
    .from(articleMetadata)
    .innerJoin(articles, eq(articleMetadata.articleId, articles.id))
    .where(whereCondition);

  const rows = await db
    .select({
      id: articles.id,
      title: articles.title,
      author: articles.author,
      source: articles.source,
      originalUrl: articles.originalUrl,
      publishTime: articles.publishTime,
      coverImage: articleMetadata.coverImage,
      sourceType: articleMetadata.sourceType,
      clientId: articleMetadata.clientId,
      clientName: mcpClients.name,
      isFavorited: articleMetadata.isFavorited,
      isArchived: articleMetadata.isArchived,
      aiSummary: articleMetadata.aiSummary,
      createdAt: articleMetadata.createdAt,
      updatedAt: articleMetadata.updatedAt,
    })
    .from(articleMetadata)
    .innerJoin(articles, eq(articleMetadata.articleId, articles.id))
    .leftJoin(mcpClients, eq(articleMetadata.clientId, mcpClients.id))
    .where(whereCondition)
    .orderBy(desc(articleMetadata.createdAt), desc(articleMetadata.id))
    .limit(perPage)
    .offset((page - 1) * perPage);

  return c.json({
    user: { id: targetUser.id, username: targetUser.username, role: targetUser.role, status: targetUser.status },
    page,
    per_page: perPage,
    total: Number(total ?? 0),
    data: rows.map(serializeAdminLibraryArticle),
  });
});

/** 管理员：将用户的一篇文章显式复制到自己的私人收件箱。 */
authRoutes.post('/admin/users/:id/articles/:articleId/copy-to-me', requireAdmin, async (c) => {
  const targetUserId = Number(c.req.param('id'));
  const articleId = Number(c.req.param('articleId'));
  if (!Number.isFinite(targetUserId) || !Number.isFinite(articleId)) return c.json({ error: { code: 'BAD_REQUEST', message: '用户或文章 ID 无效' } }, 400);

  const [source] = await db.select().from(articleMetadata)
    .where(and(eq(articleMetadata.userId, targetUserId), eq(articleMetadata.articleId, articleId)))
    .limit(1);
  if (!source) return c.json({ error: { code: 'ARTICLE_NOT_FOUND', message: '该文章不属于目标用户' } }, 404);

  const actorUserId = getCurrentUser(c).id as number;
  const [existing] = await db.select({ id: articleMetadata.id }).from(articleMetadata)
    .where(and(eq(articleMetadata.userId, actorUserId), eq(articleMetadata.articleId, articleId)))
    .limit(1);

  let created = false;
  if (!existing) {
    await db.insert(articleMetadata).values({
      articleId,
      userId: actorUserId,
      sourceType: 'admin-copy',
      contentMd: source.contentMd,
      contentHtml: source.contentHtml,
      contentHtmlMobile: source.contentHtmlMobile,
      coverImage: source.coverImage,
      aiSummary: source.aiSummary,
      aiCategory: source.aiCategory,
      aiTags: source.aiTags,
      isFavorited: false,
      isArchived: false,
    });
    created = true;
  }

  await writeAdminAudit({
    actorUserId,
    targetUserId,
    articleId,
    action: 'article_copied_to_admin',
    detail: { created },
  });
  return c.json({ article_id: articleId, copied_to_user_id: actorUserId, created });
});

/** 管理员：在目标用户的数据空间内重新生成 AI 摘要与标签。 */
authRoutes.post('/admin/users/:id/articles/:articleId/regenerate-ai', requireAdmin, async (c) => {
  const targetUserId = Number(c.req.param('id'));
  const articleId = Number(c.req.param('articleId'));
  if (!Number.isFinite(targetUserId) || !Number.isFinite(articleId)) return c.json({ error: { code: 'BAD_REQUEST', message: '用户或文章 ID 无效' } }, 400);

  const [source] = await db.select({ id: articleMetadata.id }).from(articleMetadata)
    .where(and(eq(articleMetadata.userId, targetUserId), eq(articleMetadata.articleId, articleId)))
    .limit(1);
  if (!source) return c.json({ error: { code: 'ARTICLE_NOT_FOUND', message: '该文章不属于目标用户' } }, 404);

  await generateSummaryAndTags(articleId, targetUserId);
  await writeAdminAudit({
    actorUserId: getCurrentUser(c).id,
    targetUserId,
    articleId,
    action: 'article_ai_regenerated',
  });
  return c.json({ article_id: articleId, user_id: targetUserId, regenerated: true });
});

/**
 * 管理员：仅删除目标用户的私有元数据，不会删除其他用户或全局 articles 内容。
 */
authRoutes.delete('/admin/users/:id/articles/:articleId', requireAdmin, async (c) => {
  const targetUserId = Number(c.req.param('id'));
  const articleId = Number(c.req.param('articleId'));
  if (!Number.isFinite(targetUserId) || !Number.isFinite(articleId)) return c.json({ error: { code: 'BAD_REQUEST', message: '用户或文章 ID 无效' } }, 400);

  const [source] = await db.select({ id: articleMetadata.id, sourceType: articleMetadata.sourceType }).from(articleMetadata)
    .where(and(eq(articleMetadata.userId, targetUserId), eq(articleMetadata.articleId, articleId)))
    .limit(1);
  if (!source) return c.json({ error: { code: 'ARTICLE_NOT_FOUND', message: '该文章不属于目标用户' } }, 404);

  await db.delete(articleMetadata).where(and(eq(articleMetadata.userId, targetUserId), eq(articleMetadata.articleId, articleId)));
  await writeAdminAudit({
    actorUserId: getCurrentUser(c).id,
    targetUserId,
    articleId,
    action: 'article_metadata_deleted',
    detail: { source_type: source.sourceType },
  });
  return c.json({ article_id: articleId, user_id: targetUserId, deleted: true, scope: 'metadata' });
});

/** 管理员：查看跨用户管理行为审计记录。 */
authRoutes.get('/admin/audit-logs', requireAdmin, async (c) => {
  const targetUserParam = c.req.query('target_user_id');
  const targetUserId = targetUserParam ? Number(targetUserParam) : null;
  if (targetUserParam && !Number.isFinite(targetUserId)) return c.json({ error: { code: 'BAD_REQUEST', message: 'target_user_id 无效' } }, 400);
  const requestedLimit = Number(c.req.query('limit') || 50);
  const limit = Math.max(1, Math.min(Number.isFinite(requestedLimit) ? requestedLimit : 50, 100));
  const offset = Math.max(0, Number(c.req.query('offset') || 0));
  const whereCondition = targetUserId ? eq(adminAuditLogs.targetUserId, targetUserId) : undefined;

  const [totalRow] = await db.select({ total: count() }).from(adminAuditLogs).where(whereCondition);
  const rows = await db.select({
    id: adminAuditLogs.id,
    actorUserId: adminAuditLogs.actorUserId,
    targetUserId: adminAuditLogs.targetUserId,
    articleId: adminAuditLogs.articleId,
    action: adminAuditLogs.action,
    detail: adminAuditLogs.detail,
    createdAt: adminAuditLogs.createdAt,
    actorUsername: sql<string | null>`(SELECT "username" FROM "users" WHERE "id" = ${adminAuditLogs.actorUserId})`,
    targetUsername: sql<string | null>`(SELECT "username" FROM "users" WHERE "id" = ${adminAuditLogs.targetUserId})`,
    articleTitle: sql<string | null>`(SELECT "title" FROM "articles" WHERE "id" = ${adminAuditLogs.articleId})`,
  }).from(adminAuditLogs).where(whereCondition).orderBy(desc(adminAuditLogs.createdAt), desc(adminAuditLogs.id)).limit(limit).offset(offset);

  return c.json({
    total: Number(totalRow?.total ?? 0),
    limit,
    offset,
    logs: rows.map((row) => ({
      id: row.id,
      actor_user_id: row.actorUserId,
      actor_username: row.actorUsername,
      target_user_id: row.targetUserId,
      target_username: row.targetUsername,
      article_id: row.articleId,
      article_title: row.articleTitle,
      action: row.action,
      detail: row.detail ?? null,
      created_at: timestampToIso(row.createdAt),
    })),
  });
});

/**
 * 管理员：创建用户或 service owner
 * POST /admin/users
 */
authRoutes.post('/admin/users', requireAdmin, async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = adminCreateUserSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'BAD_REQUEST', message: parsed.error.errors[0]?.message || '参数错误' } }, 400);
  }

  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.username, parsed.data.username)).limit(1);
  if (existing) {
    return c.json({ error: { code: 'USER_EXISTS', message: '用户名已存在' } }, 409);
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  const [created] = await db.insert(users).values({
    username: parsed.data.username,
    passwordHash,
    role: parsed.data.role,
    status: parsed.data.status,
  }).returning();

  return c.json({ user: serializeUser(created) }, 201);
});

/**
 * 管理员：更新用户角色、状态或重置密码
 * PATCH /admin/users/:id
 */
authRoutes.patch('/admin/users/:id', requireAdmin, async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) return c.json({ error: { code: 'BAD_REQUEST', message: '用户 ID 无效' } }, 400);

  const body = await c.req.json().catch(() => null);
  const parsed = adminUpdateUserSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'BAD_REQUEST', message: parsed.error.errors[0]?.message || '参数错误' } }, 400);
  }

  const [existing] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!existing) return c.json({ error: { code: 'USER_NOT_FOUND', message: '用户不存在' } }, 404);

  const currentUser = getCurrentUser(c);
  const configuredAdmin = await getConfiguredAdminStatus();
  if (existing.role === 'admin' && parsed.data.status === 'disabled') {
    return c.json({ error: { code: 'ADMIN_DISABLE_FORBIDDEN', message: '管理员账号受保护，不能被禁用' } }, 409);
  }
  if (existing.role === 'admin' && parsed.data.role !== undefined && parsed.data.role !== 'admin') {
    return c.json({ error: { code: 'ADMIN_ROLE_CHANGE_FORBIDDEN', message: '管理员账号受保护，不能降级为其他角色' } }, 409);
  }
  if (existing.id === currentUser.id && parsed.data.status === 'disabled') {
    return c.json({ error: { code: 'SELF_DISABLE_FORBIDDEN', message: '不能在当前登录会话中禁用自己' } }, 409);
  }
  if (existing.username === configuredAdmin.configuredUsername && parsed.data.username && parsed.data.username !== existing.username) {
    return c.json({ error: { code: 'CONFIGURED_ADMIN_USERNAME_PROTECTED', message: '启动配置管理员的用户名不能在此修改' } }, 409);
  }

  if (parsed.data.username !== undefined && parsed.data.username !== existing.username) {
    const [duplicate] = await db.select({ id: users.id }).from(users).where(eq(users.username, parsed.data.username)).limit(1);
    if (duplicate) return c.json({ error: { code: 'USER_EXISTS', message: '用户名已存在' } }, 409);
  }

  const values: Partial<typeof users.$inferInsert> = { updatedAt: new Date() };
  if (parsed.data.username !== undefined) values.username = parsed.data.username;
  if (parsed.data.role !== undefined) values.role = parsed.data.role;
  if (parsed.data.status !== undefined) values.status = parsed.data.status;
  if (parsed.data.password !== undefined) values.passwordHash = await bcrypt.hash(parsed.data.password, 10);

  const [updated] = await db.update(users).set(values).where(eq(users.id, id)).returning();
  return c.json({ user: serializeUser(updated) });
});
