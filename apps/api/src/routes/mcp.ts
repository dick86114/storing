import { Hono } from 'hono';
import { z } from 'zod';
import { requireMcpClient, requireMcpScope } from '../middleware/mcp-auth.js';
import { createCollectJob, getCollectJob } from '../services/collect.service.js';

export const mcpRoutes = new Hono();

const summarizeSchema = z.object({
  url: z.string().min(1, '请输入链接').max(4000, '链接过长'),
  language: z.string().trim().min(1).max(32).optional(),
  summary_style: z.enum(['brief', 'detailed', 'bullet']).optional(),
  save_to_inbox: z.boolean().optional(),
});

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

mcpRoutes.post('/mcp/summarize', requireMcpClient, requireMcpScope('summary:create'), async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = summarizeSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: 'BAD_REQUEST', message: parsed.error.errors[0]?.message || '参数错误' } }, 400);
  }

  if (parsed.data.save_to_inbox) {
    return c.json({ error: { code: 'MCP_SAVE_TO_INBOX_UNAVAILABLE', message: '当前阶段暂不支持 MCP 直接写入收件箱，请后续使用 collect_url 能力。' } }, 400);
  }

  const client = c.get('mcpClient');
  const job = await createCollectJob(parsed.data.url, {
    userId: client.ownerUserId,
    clientId: client.id,
    requestSource: 'mcp',
    saveToInbox: false,
  });

  return c.json({
    status: 'running',
    job_id: job.id,
    message: '文章正在抓取和总结，请稍后调用 get_collect_status 查询结果。',
  }, 202);
});

mcpRoutes.get('/mcp/jobs/:id', requireMcpClient, requireMcpScope('job:read:self'), async (c) => {
  const id = Number(c.req.param('id'));
  if (!Number.isFinite(id)) {
    return c.json({ error: { code: 'BAD_REQUEST', message: '任务 ID 无效' } }, 400);
  }

  const client = c.get('mcpClient');
  const job = await getCollectJob(id, { clientId: client.id, requestSource: 'mcp' });
  if (!job) {
    return c.json({ error: { code: 'JOB_NOT_FOUND', message: '任务不存在或无权访问' } }, 404);
  }

  return c.json(serializeMcpJob(job));
});
