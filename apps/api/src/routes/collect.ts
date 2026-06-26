import { Hono } from 'hono';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { clearFinishedCollectJobs, createCollectJob, deleteCollectJob, getCollectJob, listCollectJobs, processCollectJob } from '../services/collect.service.js';

export const collectRoutes = new Hono();

const collectSchema = z.object({
  url: z.string().min(1, '请输入链接').max(4000, '链接过长'),
});

function serializeJob(job: any) {
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
    error: job.error,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    startedAt: job.startedAt,
    finishedAt: job.finishedAt,
  };
}

collectRoutes.post('/collect', requireAuth, async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = collectSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'BAD_REQUEST', message: parsed.error.errors[0]?.message || '参数错误' } }, 400);
  }

  try {
    const job = await createCollectJob(parsed.data.url);
    return c.json({ job: serializeJob(job) }, 202);
  } catch (e) {
    const message = e instanceof Error ? e.message : '创建采集任务失败';
    return c.json({ error: { code: 'COLLECT_FAILED', message } }, 400);
  }
});

collectRoutes.get('/collect/jobs', requireAuth, async (c) => {
  const limit = Math.min(30, Math.max(1, Number(c.req.query('limit') || 12)));
  const offset = Math.max(0, Number(c.req.query('offset') || 0));
  const result = await listCollectJobs(limit, offset);
  return c.json({
    jobs: result.jobs.map(serializeJob),
    total: result.total,
    hasMore: result.hasMore,
  });
});

collectRoutes.get('/collect/jobs/:id', requireAuth, async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) return c.json({ error: { code: 'BAD_REQUEST', message: '任务 ID 无效' } }, 400);

  const job = await getCollectJob(id);
  if (!job) return c.json({ error: { code: 'NOT_FOUND', message: '任务不存在' } }, 404);
  return c.json({ job: serializeJob(job) });
});

collectRoutes.post('/collect/jobs/:id/retry', requireAuth, async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) return c.json({ error: { code: 'BAD_REQUEST', message: '任务 ID 无效' } }, 400);

  const job = await getCollectJob(id);
  if (!job) return c.json({ error: { code: 'NOT_FOUND', message: '任务不存在' } }, 404);
  if (job.status === 'running') return c.json({ job: serializeJob(job) });

  processCollectJob(id).catch((e) => console.error(`Collect retry ${id} failed:`, e.message));
  return c.json({ job: serializeJob({ ...job, status: 'pending', stage: 'queued', error: null }) });
});

collectRoutes.delete('/collect/jobs', requireAuth, async (c) => {
  const result = await clearFinishedCollectJobs();
  return c.json(result);
});

collectRoutes.delete('/collect/jobs/:id', requireAuth, async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) return c.json({ error: { code: 'BAD_REQUEST', message: '任务 ID 无效' } }, 400);

  const result = await deleteCollectJob(id);
  if (!result.deleted && result.reason === 'not_found') {
    return c.json({ error: { code: 'NOT_FOUND', message: '任务不存在' } }, 404);
  }
  if (!result.deleted && result.reason === 'running') {
    return c.json({ error: { code: 'JOB_RUNNING', message: '运行中的采集任务暂不能删除' } }, 409);
  }
  return c.json({ deleted: true });
});
