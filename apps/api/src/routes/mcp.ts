import { Hono } from 'hono';
import { z } from 'zod';
import { getCurrentUser, requireAdmin, requireAuth } from '../middleware/auth.js';
import { auditMcpRequest, requireMcpClient, requireMcpScope } from '../middleware/mcp-auth.js';
import { createCollectJob, getCollectJob, waitForCollectJob } from '../services/collect.service.js';
import { checkMcpConcurrentCollectLimit, createMcpClient, deleteMcpClient, getMcpPlatformSettings, listMcpClients, listMcpRequestLogs, rotateMcpClientApiKey, updateMcpClient, updateMcpPlatformSettings } from '../services/mcp-auth.service.js';

export const mcpRoutes = new Hono();

const summarizeSchema = z.object({
  url: z.string().min(1, '请输入链接').max(4000, '链接过长'),
  language: z.string().trim().min(1).max(32).optional(),
  summary_style: z.enum(['brief', 'detailed', 'bullet']).optional(),
  save_to_inbox: z.boolean().optional(),
});

const collectUrlSchema = z.object({
  url: z.string().min(1, '请输入链接').max(4000, '链接过长'),
});

const createMcpClientSchema = z.object({
  name: z.string().trim().min(2, 'Client 名称至少 2 个字符').max(80, 'Client 名称过长'),
  owner_user_id: z.number().int().positive('请选择 owner 用户'),
  scopes: z.array(z.string().trim().min(1)).default(['summary:create', 'job:read:self']),
  enabled: z.boolean().optional(),
  rate_limit_per_minute: z.number().int().positive().nullable().optional(),
  rate_limit_per_day: z.number().int().positive().nullable().optional(),
  concurrent_collect_limit: z.number().int().positive().nullable().optional(),
  default_save_to_inbox: z.boolean().optional(),
});

const updateMcpClientSchema = z.object({
  enabled: z.boolean().optional(),
  scopes: z.array(z.string().trim().min(1)).optional(),
  rate_limit_per_minute: z.number().int().positive().nullable().optional(),
  rate_limit_per_day: z.number().int().positive().nullable().optional(),
  concurrent_collect_limit: z.number().int().positive().nullable().optional(),
  default_save_to_inbox: z.boolean().optional(),
});

const createMyMcpClientSchema = createMcpClientSchema.omit({
  owner_user_id: true,
  rate_limit_per_minute: true,
  rate_limit_per_day: true,
  concurrent_collect_limit: true,
});

const updateMyMcpClientSchema = updateMcpClientSchema.omit({
  rate_limit_per_minute: true,
  rate_limit_per_day: true,
  concurrent_collect_limit: true,
});

const updateMcpPlatformSettingsSchema = z.object({
  rate_limit_per_minute: z.number().int().positive(),
  rate_limit_per_day: z.number().int().positive(),
  concurrent_collect_limit: z.number().int().positive(),
});

function serializeMcpClient(client: any) {
  return {
    id: client.id,
    name: client.name,
    owner_user_id: client.ownerUserId,
    owner_username: client.ownerUsername ?? null,
    scopes: client.scopes ?? [],
    enabled: client.enabled,
    rate_limit_per_minute: client.rateLimitPerMinute ?? null,
    rate_limit_per_day: client.rateLimitPerDay ?? null,
    concurrent_collect_limit: client.concurrentCollectLimit ?? null,
    default_save_to_inbox: client.defaultSaveToInbox,
    created_at: client.createdAt,
    updated_at: client.updatedAt,
    last_used_at: client.lastUsedAt ?? null,
  };
}

function serializeMcpRequestLog(log: any) {
  return {
    id: log.id,
    client_id: log.clientId,
    user_id: log.userId,
    tool_name: log.toolName,
    url: log.url,
    normalized_url: log.normalizedUrl,
    status: log.status,
    error_code: log.errorCode,
    duration_ms: log.durationMs,
    transport: log.transport ?? 'unknown',
    client_agent: log.clientAgent ?? null,
    request_method: log.requestMethod ?? null,
    request_path: log.requestPath ?? null,
    created_at: log.createdAt,
  };
}

// Remote MCP transport uses this endpoint to validate a Bearer API Key before initialization.
mcpRoutes.get('/mcp/auth/verify', requireMcpClient, async (c) => {
  const client = c.get('mcpClient');
  return c.json({
    valid: true,
    client_id: client.id,
    client_name: client.name,
    owner_user_id: client.ownerUserId,
    owner_username: client.ownerUsername,
    scopes: client.scopes,
  });
});

mcpRoutes.get('/mcp/me/limits', requireAuth, async (c) => {
  const settings = await getMcpPlatformSettings();
  return c.json({
    rate_limit_per_minute: settings.rateLimitPerMinute,
    rate_limit_per_day: settings.rateLimitPerDay,
    concurrent_collect_limit: settings.concurrentCollectLimit,
    updated_at: settings.updatedAt,
    managed_by: 'platform',
  });
});

// 登录用户自助管理自己的 MCP clients。ownerUserId 始终取自 JWT，不接受前端传入。
mcpRoutes.get('/mcp/me/clients', requireAuth, async (c) => {
  const currentUser = getCurrentUser(c);
  const clients = await listMcpClients({ ownerUserId: currentUser.id });
  return c.json({ clients: clients.map(serializeMcpClient) });
});

mcpRoutes.post('/mcp/me/clients', requireAuth, async (c) => {
  const currentUser = getCurrentUser(c);
  const body = await c.req.json().catch(() => null);
  const parsed = createMyMcpClientSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'BAD_REQUEST', message: parsed.error.errors[0]?.message || '参数错误' } }, 400);
  }

  const settings = await getMcpPlatformSettings();
  const result = await createMcpClient({
    name: parsed.data.name,
    ownerUserId: currentUser.id,
    scopes: parsed.data.scopes,
    enabled: parsed.data.enabled,
    rateLimitPerMinute: settings.rateLimitPerMinute,
    rateLimitPerDay: settings.rateLimitPerDay,
    concurrentCollectLimit: settings.concurrentCollectLimit,
    defaultSaveToInbox: parsed.data.default_save_to_inbox,
  });
  if (!result) return c.json({ error: { code: 'USER_DISABLED', message: '当前用户不可创建 MCP client' } }, 403);

  return c.json({ client: serializeMcpClient(result.client), api_key: result.apiKey }, 201);
});

mcpRoutes.patch('/mcp/me/clients/:id', requireAuth, async (c) => {
  const currentUser = getCurrentUser(c);
  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) return c.json({ error: { code: 'BAD_REQUEST', message: 'Client ID 无效' } }, 400);
  const body = await c.req.json().catch(() => null);
  const parsed = updateMyMcpClientSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'BAD_REQUEST', message: parsed.error.errors[0]?.message || '参数错误' } }, 400);
  }
  const client = await updateMcpClient(id, {
    ownerUserId: currentUser.id,
    enabled: parsed.data.enabled,
    scopes: parsed.data.scopes,
    defaultSaveToInbox: parsed.data.default_save_to_inbox,
  });
  if (!client) return c.json({ error: { code: 'MCP_CLIENT_NOT_FOUND', message: 'MCP client 不存在或不属于当前用户' } }, 404);
  return c.json({ client: serializeMcpClient(client) });
});

mcpRoutes.post('/mcp/me/clients/:id/rotate-key', requireAuth, async (c) => {
  const currentUser = getCurrentUser(c);
  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) return c.json({ error: { code: 'BAD_REQUEST', message: 'Client ID 无效' } }, 400);
  const result = await rotateMcpClientApiKey(id, currentUser.id);
  if (!result) return c.json({ error: { code: 'MCP_CLIENT_NOT_FOUND', message: 'MCP client 不存在或不属于当前用户' } }, 404);
  return c.json({ client: result.client, api_key: result.apiKey });
});

mcpRoutes.delete('/mcp/me/clients/:id', requireAuth, async (c) => {
  const currentUser = getCurrentUser(c);
  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) return c.json({ error: { code: 'BAD_REQUEST', message: 'Client ID 无效' } }, 400);
  const deleted = await deleteMcpClient(id, currentUser.id);
  if (!deleted) return c.json({ error: { code: 'MCP_CLIENT_NOT_FOUND', message: 'MCP client 不存在或不属于当前用户' } }, 404);
  return c.json({ client: deleted, revoked: true });
});

mcpRoutes.get('/mcp/me/request-logs', requireAuth, async (c) => {
  const currentUser = getCurrentUser(c);
  const limit = Number(c.req.query('limit') || 50);
  const offset = Number(c.req.query('offset') || 0);
  const logs = await listMcpRequestLogs({ userId: currentUser.id, limit, offset });
  return c.json({ logs: logs.map(serializeMcpRequestLog) });
});

mcpRoutes.get('/admin/mcp/default-limits', requireAdmin, async (c) => {
  const settings = await getMcpPlatformSettings();
  return c.json({
    rate_limit_per_minute: settings.rateLimitPerMinute,
    rate_limit_per_day: settings.rateLimitPerDay,
    concurrent_collect_limit: settings.concurrentCollectLimit,
    updated_at: settings.updatedAt,
  });
});

mcpRoutes.patch('/admin/mcp/default-limits', requireAdmin, async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = updateMcpPlatformSettingsSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'BAD_REQUEST', message: parsed.error.errors[0]?.message || '参数错误' } }, 400);
  }

  const settings = await updateMcpPlatformSettings({
    rateLimitPerMinute: parsed.data.rate_limit_per_minute,
    rateLimitPerDay: parsed.data.rate_limit_per_day,
    concurrentCollectLimit: parsed.data.concurrent_collect_limit,
  });
  return c.json({
    rate_limit_per_minute: settings.rateLimitPerMinute,
    rate_limit_per_day: settings.rateLimitPerDay,
    concurrent_collect_limit: settings.concurrentCollectLimit,
    updated_at: settings.updatedAt,
  });
});

mcpRoutes.get('/admin/mcp/clients', requireAdmin, async (c) => {
  const clients = await listMcpClients();
  return c.json({ clients: clients.map(serializeMcpClient) });
});

mcpRoutes.post('/admin/mcp/clients', requireAdmin, async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = createMcpClientSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'BAD_REQUEST', message: parsed.error.errors[0]?.message || '参数错误' } }, 400);
  }

  const result = await createMcpClient({
    name: parsed.data.name,
    ownerUserId: parsed.data.owner_user_id,
    scopes: parsed.data.scopes,
    enabled: parsed.data.enabled,
    rateLimitPerMinute: parsed.data.rate_limit_per_minute,
    rateLimitPerDay: parsed.data.rate_limit_per_day,
    concurrentCollectLimit: parsed.data.concurrent_collect_limit,
    defaultSaveToInbox: parsed.data.default_save_to_inbox,
  });
  if (!result) return c.json({ error: { code: 'OWNER_USER_NOT_FOUND', message: 'Owner 用户不存在或已禁用' } }, 404);

  return c.json({ client: serializeMcpClient(result.client), api_key: result.apiKey }, 201);
});

mcpRoutes.patch('/admin/mcp/clients/:id', requireAdmin, async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) return c.json({ error: { code: 'BAD_REQUEST', message: 'Client ID 无效' } }, 400);

  const body = await c.req.json().catch(() => null);
  const parsed = updateMcpClientSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'BAD_REQUEST', message: parsed.error.errors[0]?.message || '参数错误' } }, 400);
  }

  const client = await updateMcpClient(id, {
    enabled: parsed.data.enabled,
    scopes: parsed.data.scopes,
    rateLimitPerMinute: parsed.data.rate_limit_per_minute,
    rateLimitPerDay: parsed.data.rate_limit_per_day,
    concurrentCollectLimit: parsed.data.concurrent_collect_limit,
    defaultSaveToInbox: parsed.data.default_save_to_inbox,
  });
  if (!client) return c.json({ error: { code: 'MCP_CLIENT_NOT_FOUND', message: 'MCP client 不存在' } }, 404);
  return c.json({ client: serializeMcpClient(client) });
});

mcpRoutes.post('/admin/mcp/clients/:id/rotate-key', requireAdmin, async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) return c.json({ error: { code: 'BAD_REQUEST', message: 'Client ID 无效' } }, 400);

  const result = await rotateMcpClientApiKey(id);
  if (!result) return c.json({ error: { code: 'MCP_CLIENT_NOT_FOUND', message: 'MCP client 不存在' } }, 404);
  return c.json({ client: result.client, api_key: result.apiKey });
});

mcpRoutes.delete('/admin/mcp/clients/:id', requireAdmin, async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) return c.json({ error: { code: 'BAD_REQUEST', message: 'Client ID 无效' } }, 400);

  const deleted = await deleteMcpClient(id);
  if (!deleted) return c.json({ error: { code: 'MCP_CLIENT_NOT_FOUND', message: 'MCP client 不存在' } }, 404);
  return c.json({ client: deleted, revoked: true });
});

mcpRoutes.get('/admin/mcp/request-logs', requireAdmin, async (c) => {
  const clientIdParam = c.req.query('client_id');
  const clientId = clientIdParam ? Number(clientIdParam) : undefined;
  if (clientIdParam && !Number.isFinite(clientId)) {
    return c.json({ error: { code: 'BAD_REQUEST', message: 'client_id 无效' } }, 400);
  }
  const limit = Number(c.req.query('limit') || 50);
  const offset = Number(c.req.query('offset') || 0);
  const logs = await listMcpRequestLogs({ clientId, limit, offset });
  return c.json({ logs: logs.map(serializeMcpRequestLog) });
});


async function ensureMcpCollectSlot(c: any) {
  const client = c.get('mcpClient');
  const limit = await checkMcpConcurrentCollectLimit(client);
  if (limit.allowed) return null;
  c.set('mcpAuditErrorCode', 'MCP_RATE_LIMITED');
  return c.json({
    error: {
      code: 'MCP_RATE_LIMITED',
      message: `MCP client 并发采集任务过多，已达到 ${limit.limit} 个上限`,
      window: 'concurrent',
      limit: limit.limit,
    },
  }, 429);
}

function serializeMcpJob(job: any) {
  return {
    id: job.id,
    status: job.status,
    stage: job.stage,
    article_id: job.articleId ?? null,
    title: job.title ?? null,
    summary: job.resultJson?.summary ?? null,
    category: job.resultJson?.category ?? null,
    tags: job.resultJson?.tags ?? [],
    saved_to_inbox: job.resultJson?.savedToInbox ?? job.saveToInbox ?? false,
    error: job.error
      ? {
          message: job.error,
        }
      : null,
    created_at: job.createdAt,
    updated_at: job.updatedAt,
    finished_at: job.finishedAt,
  };
}

mcpRoutes.post('/mcp/summarize', requireMcpClient, auditMcpRequest('summarize_url'), requireMcpScope('summary:create'), async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = summarizeSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'BAD_REQUEST', message: parsed.error.errors[0]?.message || '参数错误' } }, 400);
  }

  c.set('mcpAuditUrl', parsed.data.url);

  if (parsed.data.save_to_inbox) {
    return c.json({ error: { code: 'MCP_SAVE_TO_INBOX_UNAVAILABLE', message: '当前阶段暂不支持 MCP 直接写入收件箱，请后续使用 collect_url 能力。' } }, 400);
  }

  const slotError = await ensureMcpCollectSlot(c);
  if (slotError) return slotError;

  const client = c.get('mcpClient');
  const job = await createCollectJob(parsed.data.url, {
    userId: client.ownerUserId,
    clientId: client.id,
    requestSource: 'mcp',
    saveToInbox: false,
  });
  c.set('mcpAuditNormalizedUrl', job.normalizedUrl);

  return c.json({
    status: 'running',
    job_id: job.id,
    message: '文章正在抓取和总结，请稍后调用 get_collect_status 查询结果。',
  }, 202);
});



mcpRoutes.post('/mcp/collect', requireMcpClient, auditMcpRequest('collect_url'), requireMcpScope('collect:create'), requireMcpScope('inbox:write'), async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = collectUrlSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'BAD_REQUEST', message: parsed.error.errors[0]?.message || '参数错误' } }, 400);
  }

  c.set('mcpAuditUrl', parsed.data.url);

  const slotError = await ensureMcpCollectSlot(c);
  if (slotError) return slotError;

  const client = c.get('mcpClient');
  const job = await createCollectJob(parsed.data.url, {
    userId: client.ownerUserId,
    clientId: client.id,
    requestSource: 'mcp',
    saveToInbox: true,
  });
  c.set('mcpAuditNormalizedUrl', job.normalizedUrl);

  return c.json({
    status: 'running',
    job_id: job.id,
    saved_to_inbox: true,
    message: '文章正在抓取，并会保存到 MCP client owner 的收件箱。请稍后调用 get_collect_status 查询结果。',
  }, 202);
});

mcpRoutes.get('/mcp/jobs/:id', requireMcpClient, auditMcpRequest('get_collect_status'), requireMcpScope('job:read:self'), async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) {
    c.set('mcpAuditErrorCode', 'BAD_REQUEST');
    return c.json({ error: { code: 'BAD_REQUEST', message: '任务 ID 无效' } }, 400);
  }

  const client = c.get('mcpClient');
  const requestedWaitSeconds = Number(c.req.query('wait_seconds') || 0);
  const waitSeconds = Number.isFinite(requestedWaitSeconds)
    ? Math.min(Math.max(Math.floor(requestedWaitSeconds), 0), 60)
    : 0;
  const job = waitSeconds > 0
    ? await waitForCollectJob(id, { clientId: client.id, requestSource: 'mcp' }, waitSeconds * 1000)
    : await getCollectJob(id, { clientId: client.id, requestSource: 'mcp' });
  if (!job) {
    c.set('mcpAuditErrorCode', 'JOB_NOT_FOUND');
    return c.json({ error: { code: 'JOB_NOT_FOUND', message: '任务不存在或无权访问' } }, 404);
  }

  return c.json(serializeMcpJob(job));
});
