import { Hono } from 'hono';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { clearFinishedCollectJobs, createCollectJob, deleteCollectJob, getCollectJob, listCollectJobs, processCollectJob } from '../services/collect.service.js';

export const collectRoutes = new Hono();

const collectSchema = z.object({
  url: z.string().min(1, '请输入链接').max(4000, '链接过长'),
});

function formatCollectError(error?: string | null) {
  if (!error) {
    return {
      summary: null,
      details: [] as string[],
      hint: null as string | null,
    };
  }

  const normalized = error.replace(/\s+/g, ' ').trim();
  const details: string[] = [];
  let summary = normalized;
  let hint: string | null = null;

  if (/desktop:/i.test(normalized) || /mobile:/i.test(normalized)) {
    summary = '网页正文未通过有效性校验';
    const parts = normalized.split('；').map((part) => part.trim()).filter(Boolean);
    for (const part of parts) {
      if (/^desktop:/i.test(part)) {
        details.push(`桌面抓取：${part.replace(/^desktop:\s*/i, '')}`);
      } else if (/^mobile:/i.test(part)) {
        details.push(`移动抓取：${part.replace(/^mobile:\s*/i, '')}`);
      } else {
        details.push(part);
      }
    }
  } else if (/验证码|风控|验证页|captcha|verification/i.test(normalized)) {
    summary = '采集被站点风控或验证页拦截';
    details.push(normalized);
  } else if (/正文过短|缺少有效正文|壳页|异常页/i.test(normalized)) {
    summary = '抓取结果不像有效正文';
    details.push(normalized);
  } else if (/SingleFile 服务失败/i.test(normalized)) {
    summary = '网页镜像服务执行失败';
    details.push(normalized);
  } else {
    details.push(normalized);
  }

  if (/验证码|风控|验证页|captcha|verification/i.test(normalized)) {
    hint = '建议稍后重试；如果站点分桌面/移动页，可优先使用更稳定的入口链接。';
  } else if (/正文过短|缺少有效正文|壳页|异常页/i.test(normalized)) {
    hint = '建议检查链接是否跳转到了活动页、壳页或登录页，再重新采集。';
  } else if (/SingleFile 服务失败/i.test(normalized)) {
    hint = '建议检查 SingleFile sidecar、本机命令或网络访问状态。';
  }

  return { summary, details, hint };
}

function serializeJob(job: any) {
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
