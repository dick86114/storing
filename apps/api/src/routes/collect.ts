import { Hono } from 'hono';
import { z } from 'zod';
import { getCurrentUser, requireAuth } from '../middleware/auth.js';
import { formatCollectError } from '../services/collect-capture-diagnostics.js';
import { clearFinishedCollectJobs, createCollectJob, deleteCollectJob, getCollectJob, listCollectJobs, retryCollectJob, USER_COLLECT_SOURCES } from '../services/collect.service.js';

export const collectRoutes = new Hono();

const collectSchema = z.object({
  url: z.string().min(1, '请输入链接').max(4000, '链接过长'),
});

const mobileCollectSchema = collectSchema.extend({
  source: z.enum(['android', 'android_share']).default('android'),
});

function serializeJob(job: any, includeResult = true) {
  const errorInfo = formatCollectError(job.error);
  return {
    id: job.id,
    url: job.url,
    normalizedUrl: job.normalizedUrl,
    status: job.status,
    stage: job.stage,
    method: job.method,
    captureStrategy: job.captureStrategy ?? job.capture_strategy ?? null,
    articleId: job.articleId,
    title: job.title,
    ...(includeResult ? { result: job.resultJson ?? null } : {}),
    error: job.error,
    errorSummary: errorInfo.summary,
    errorDetails: errorInfo.details,
    errorHint: errorInfo.hint,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
  };
}



/** Native Android collection routes deliberately keep a separate source namespace from Web. */
collectRoutes.post('/mobile/collect', requireAuth, async (c) => {
  const parsed = mobileCollectSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: { code: 'BAD_REQUEST', message: parsed.error.errors[0]?.message || '参数错误' } }, 400);
  try {
    const user = getCurrentUser(c);
    const job = await createCollectJob(parsed.data.url, { userId: user.id, requestSource: parsed.data.source, saveToInbox: true });
    return c.json({ job: serializeJob(job) }, 202);
  } catch (error) {
    console.error('Create mobile collect job failed:', error instanceof Error ? error.message : String(error));
    return c.json({ error: { code: 'COLLECT_FAILED', message: '创建采集任务失败' } }, 400);
  }
});

collectRoutes.get('/mobile/collect/jobs', requireAuth, async (c) => {
  const limit = Math.min(30, Math.max(1, Number(c.req.query('limit') || 12)));
  const offset = Math.max(0, Number(c.req.query('offset') || 0));
  const user = getCurrentUser(c);
  const result = await listCollectJobs(limit, offset, { userId: user.id, requestSource: ['android', 'android_share'] });
  return c.json({ jobs: result.jobs.map((job) => serializeJob(job, false)), total: result.total, hasMore: result.hasMore });
});

collectRoutes.get('/mobile/collect/jobs/:id', requireAuth, async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) return c.json({ error: { code: 'BAD_REQUEST', message: '任务 ID 无效' } }, 400);
  const user = getCurrentUser(c);
  const job = await getCollectJob(id, { userId: user.id, requestSource: ['android', 'android_share'] });
  if (!job) return c.json({ error: { code: 'NOT_FOUND', message: '任务不存在' } }, 404);
  return c.json({ job: serializeJob(job) });
});

collectRoutes.post('/mobile/collect/jobs/:id/retry', requireAuth, async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) return c.json({ error: { code: 'BAD_REQUEST', message: '任务 ID 无效' } }, 400);
  const user = getCurrentUser(c);
  const job = await getCollectJob(id, { userId: user.id, requestSource: ['android', 'android_share'] });
  if (!job) return c.json({ error: { code: 'NOT_FOUND', message: '任务不存在' } }, 404);
  if (job.status === 'running') return c.json({ job: serializeJob(job) });
  await retryCollectJob(id);
  return c.json({ job: serializeJob({ ...job, status: 'pending', stage: 'queued', error: null }) });
});

collectRoutes.delete('/mobile/collect/jobs', requireAuth, async (c) => {
  const user = getCurrentUser(c);
  return c.json(await clearFinishedCollectJobs({ userId: user.id, requestSource: ['android', 'android_share'] }));
});

collectRoutes.delete('/mobile/collect/jobs/:id', requireAuth, async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) return c.json({ error: { code: 'BAD_REQUEST', message: '任务 ID 无效' } }, 400);
  const user = getCurrentUser(c);
  const result = await deleteCollectJob(id, { userId: user.id, requestSource: ['android', 'android_share'] });
  if (!result.deleted && result.reason === 'not_found') return c.json({ error: { code: 'NOT_FOUND', message: '任务不存在' } }, 404);
  if (!result.deleted && result.reason === 'running') return c.json({ error: { code: 'JOB_RUNNING', message: '运行中的采集任务暂不能删除' } }, 409);
  return c.json({ deleted: true });
});

/** macOS 原生客户端使用独立来源命名空间，任务仍复用共享采集队列。 */
collectRoutes.post('/macos/collect', requireAuth, async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = collectSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'BAD_REQUEST', message: parsed.error.errors[0]?.message || '参数错误' } }, 400);
  }

  try {
    const user = getCurrentUser(c);
    const job = await createCollectJob(parsed.data.url, { userId: user.id, requestSource: 'macos', saveToInbox: true });
    return c.json({ job: serializeJob(job) }, 202);
  } catch (error) {
    console.error('Create macOS collect job failed:', error instanceof Error ? error.message : String(error));
    return c.json({ error: { code: 'COLLECT_FAILED', message: '创建采集任务失败' } }, 400);
  }
});

collectRoutes.get('/macos/collect/jobs', requireAuth, async (c) => {
  const limit = Math.min(30, Math.max(1, Number(c.req.query('limit') || 12)));
  const offset = Math.max(0, Number(c.req.query('offset') || 0));
  const user = getCurrentUser(c);
  const result = await listCollectJobs(limit, offset, { userId: user.id, requestSource: USER_COLLECT_SOURCES });
  return c.json({ jobs: result.jobs.map((job) => serializeJob(job, false)), total: result.total, hasMore: result.hasMore });
});

collectRoutes.get('/macos/collect/jobs/:id', requireAuth, async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) return c.json({ error: { code: 'BAD_REQUEST', message: '任务 ID 无效' } }, 400);
  const user = getCurrentUser(c);
  const job = await getCollectJob(id, { userId: user.id, requestSource: USER_COLLECT_SOURCES });
  if (!job) return c.json({ error: { code: 'NOT_FOUND', message: '任务不存在' } }, 404);
  return c.json({ job: serializeJob(job) });
});

collectRoutes.post('/macos/collect/jobs/:id/retry', requireAuth, async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) return c.json({ error: { code: 'BAD_REQUEST', message: '任务 ID 无效' } }, 400);
  const user = getCurrentUser(c);
  const job = await getCollectJob(id, { userId: user.id, requestSource: USER_COLLECT_SOURCES });
  if (!job) return c.json({ error: { code: 'NOT_FOUND', message: '任务不存在' } }, 404);
  if (job.status === 'running') return c.json({ job: serializeJob(job) });
  await retryCollectJob(id);
  return c.json({ job: serializeJob({ ...job, status: 'pending', stage: 'queued', error: null }) });
});

collectRoutes.delete('/macos/collect/jobs', requireAuth, async (c) => {
  const user = getCurrentUser(c);
  return c.json(await clearFinishedCollectJobs({ userId: user.id, requestSource: USER_COLLECT_SOURCES }));
});

collectRoutes.delete('/macos/collect/jobs/:id', requireAuth, async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) return c.json({ error: { code: 'BAD_REQUEST', message: '任务 ID 无效' } }, 400);
  const user = getCurrentUser(c);
  const result = await deleteCollectJob(id, { userId: user.id, requestSource: USER_COLLECT_SOURCES });
  if (!result.deleted && result.reason === 'not_found') return c.json({ error: { code: 'NOT_FOUND', message: '任务不存在' } }, 404);
  if (!result.deleted && result.reason === 'running') return c.json({ error: { code: 'JOB_RUNNING', message: '运行中的采集任务暂不能删除' } }, 409);
  return c.json({ deleted: true });
});

collectRoutes.post('/collect', requireAuth, async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = collectSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'BAD_REQUEST', message: parsed.error.errors[0]?.message || '参数错误' } }, 400);
  }

  try {
    const user = getCurrentUser(c);
    const job = await createCollectJob(parsed.data.url, { userId: user.id, requestSource: 'web', saveToInbox: true });
    return c.json({ job: serializeJob(job) }, 202);
  } catch (e) {
    console.error('Create collect job failed:', e instanceof Error ? e.message : String(e));
    return c.json({ error: { code: 'COLLECT_FAILED', message: '创建采集任务失败' } }, 400);
  }
});

/** Browser extension collection deliberately keeps its own source namespace. */
collectRoutes.post('/extension/collect', requireAuth, async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = collectSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'BAD_REQUEST', message: parsed.error.errors[0]?.message || '参数错误' } }, 400);
  }

  try {
    const user = getCurrentUser(c);
    const job = await createCollectJob(parsed.data.url, { userId: user.id, requestSource: 'browser_extension', saveToInbox: true });
    return c.json({ job: serializeJob(job) }, 202);
  } catch (error) {
    console.error('Create browser extension collect job failed:', error instanceof Error ? error.message : String(error));
    return c.json({ error: { code: 'COLLECT_FAILED', message: '创建采集任务失败' } }, 400);
  }
});

collectRoutes.get('/collect/jobs', requireAuth, async (c) => {
  const limit = Math.min(30, Math.max(1, Number(c.req.query('limit') || 12)));
  const offset = Math.max(0, Number(c.req.query('offset') || 0));
  const user = getCurrentUser(c);
  const result = await listCollectJobs(limit, offset, { userId: user.id, requestSource: 'web' });
  return c.json({
    jobs: result.jobs.map((job) => serializeJob(job, false)),
    total: result.total,
    hasMore: result.hasMore,
  });
});

collectRoutes.get('/collect/jobs/:id', requireAuth, async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) return c.json({ error: { code: 'BAD_REQUEST', message: '任务 ID 无效' } }, 400);

  const user = getCurrentUser(c);
  const job = await getCollectJob(id, { userId: user.id, requestSource: 'web' });
  if (!job) return c.json({ error: { code: 'NOT_FOUND', message: '任务不存在' } }, 404);
  return c.json({ job: serializeJob(job) });
});

collectRoutes.post('/collect/jobs/:id/retry', requireAuth, async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) return c.json({ error: { code: 'BAD_REQUEST', message: '任务 ID 无效' } }, 400);

  const user = getCurrentUser(c);
  const job = await getCollectJob(id, { userId: user.id, requestSource: 'web' });
  if (!job) return c.json({ error: { code: 'NOT_FOUND', message: '任务不存在' } }, 404);
  if (job.status === 'running') return c.json({ job: serializeJob(job) });

  await retryCollectJob(id);
  return c.json({ job: serializeJob({ ...job, status: 'pending', stage: 'queued', error: null }) });
});

collectRoutes.delete('/collect/jobs', requireAuth, async (c) => {
  const user = getCurrentUser(c);
  const result = await clearFinishedCollectJobs({ userId: user.id, requestSource: 'web' });
  return c.json(result);
});

collectRoutes.delete('/collect/jobs/:id', requireAuth, async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) return c.json({ error: { code: 'BAD_REQUEST', message: '任务 ID 无效' } }, 400);

  const user = getCurrentUser(c);
  const result = await deleteCollectJob(id, { userId: user.id, requestSource: 'web' });
  if (!result.deleted && result.reason === 'not_found') {
    return c.json({ error: { code: 'NOT_FOUND', message: '任务不存在' } }, 404);
  }
  if (!result.deleted && result.reason === 'running') {
    return c.json({ error: { code: 'JOB_RUNNING', message: '运行中的采集任务暂不能删除' } }, 409);
  }
  return c.json({ deleted: true });
});
