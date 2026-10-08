import { Hono } from 'hono';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { requireAdmin, requireAuth, getCurrentUser } from '../middleware/auth.js';
import { writeAdminAudit } from '../services/admin-audit.service.js';
import {
  deleteUserAiSettings,
  getUserAiSettingsSummary,
  saveUserAiSettings,
  resolveUserAiRuntimeConfig,
} from '../services/user-ai-settings.service.js';
import { assertUserAiProvider, assertSafeAiBaseUrl, callUserAi, listAiModels } from '../services/ai-provider.service.js';
import { listAiGenerationJobs, retryAiGenerationJob } from '../services/ai-generation.service.js';

export const aiRoutes = new Hono();

const settingsInput = z.object({
  provider: z.string().trim().min(1),
  model: z.string().trim().min(1),
  baseUrl: z.string().trim().nullish(),
  apiKey: z.string().trim().optional(),
  autoTriggerOnArchive: z.boolean(),
});

const adminSettingsTestInput = settingsInput.pick({
  provider: true,
  model: true,
  baseUrl: true,
  apiKey: true,
});

const adminDiscoverModelsInput = settingsInput.pick({
  provider: true,
  baseUrl: true,
  apiKey: true,
});

async function findAdminAiTargetUser(userId: number) {
  const [user] = await db
    .select({
      id: users.id,
      username: users.username,
      role: users.role,
      status: users.status,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return user ?? null;
}

aiRoutes.get('/ai/settings', requireAuth, async (c) => {
  const settings = await getUserAiSettingsSummary(getCurrentUser(c).id as number);
  return c.json({ settings });
});

aiRoutes.put('/ai/settings', requireAuth, async (c) => {
  const parsed = settingsInput.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: { code: 'AI_SETTINGS_INVALID', message: 'AI 配置参数无效' } }, 400);
  try {
    assertUserAiProvider(parsed.data.provider, parsed.data.baseUrl);
    if (parsed.data.baseUrl) await assertSafeAiBaseUrl(parsed.data.baseUrl);
    const settings = await saveUserAiSettings(getCurrentUser(c).id as number, {
      ...parsed.data,
      apiKey: parsed.data.apiKey?.trim(),
    });
    return c.json({ settings });
  } catch (error) {
    return c.json({ error: { code: 'AI_SETTINGS_SAVE_FAILED', message: error instanceof Error ? error.message : '保存 AI 配置失败' } }, 400);
  }
});

aiRoutes.delete('/ai/settings', requireAuth, async (c) => {
  await deleteUserAiSettings(getCurrentUser(c).id as number);
  return c.json({ deleted: true });
});

aiRoutes.post('/ai/models/discover', requireAuth, async (c) => {
  const parsed = settingsInput.pick({ provider: true, baseUrl: true, apiKey: true }).safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: { code: 'AI_DISCOVERY_INVALID', message: '模型发现参数无效' } }, 400);
  try {
    const result = await listAiModels(parsed.data);
    return c.json(result);
  } catch (error) {
    return c.json({ error: { code: 'AI_DISCOVERY_FAILED', message: error instanceof Error ? error.message : '获取模型列表失败' } }, 400);
  }
});

aiRoutes.post('/ai/settings/test', requireAuth, async (c) => {
  const body = await c.req.json().catch(() => null) as { provider?: string; model?: string; baseUrl?: string | null; apiKey?: string } | null;
  const config = body?.apiKey && body?.provider && body?.model ? {
    provider: body.provider,
    model: body.model,
    baseUrl: body.baseUrl || null,
    apiKey: body.apiKey,
  } : await resolveUserAiRuntimeConfig(getCurrentUser(c).id as number);
  if (!config) return c.json({ error: { code: 'AI_NOT_CONFIGURED', message: '请先保存完整的模型配置' } }, 400);
  const startedAt = Date.now();
  try {
    await callUserAi(config, '你是连通性测试助手。', '请只回复 OK', 16);
    return c.json({ ok: true, latencyMs: Date.now() - startedAt });
  } catch (error) {
    return c.json({ error: { code: 'AI_SETTINGS_TEST_FAILED', message: error instanceof Error ? error.message : 'AI 连通性测试失败' } }, 400);
  }
});

aiRoutes.get('/ai/admin/users/:userId/settings', requireAdmin, async (c) => {
  const userId = Number(c.req.param('userId'));
  if (!Number.isInteger(userId) || userId <= 0) {
    return c.json({ error: { code: 'BAD_REQUEST', message: '用户 ID 无效' } }, 400);
  }
  if (!await findAdminAiTargetUser(userId)) {
    return c.json({ error: { code: 'USER_NOT_FOUND', message: '用户不存在' } }, 404);
  }

  const settings = await getUserAiSettingsSummary(userId);
  return c.json({ settings });
});

aiRoutes.put('/ai/admin/users/:userId/settings', requireAdmin, async (c) => {
  const userId = Number(c.req.param('userId'));
  if (!Number.isInteger(userId) || userId <= 0) {
    return c.json({ error: { code: 'BAD_REQUEST', message: '用户 ID 无效' } }, 400);
  }
  const targetUser = await findAdminAiTargetUser(userId);
  if (!targetUser) {
    return c.json({ error: { code: 'USER_NOT_FOUND', message: '用户不存在' } }, 404);
  }

  const parsed = settingsInput.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: { code: 'AI_SETTINGS_INVALID', message: 'AI 配置参数无效' } }, 400);
  try {
    assertUserAiProvider(parsed.data.provider, parsed.data.baseUrl);
    if (parsed.data.baseUrl) await assertSafeAiBaseUrl(parsed.data.baseUrl);
    const settings = await saveUserAiSettings(userId, {
      ...parsed.data,
      apiKey: parsed.data.apiKey?.trim(),
    });
    await writeAdminAudit({
      actorUserId: getCurrentUser(c).id as number,
      targetUserId: userId,
      action: 'admin_user_ai_settings_updated',
      detail: {
        provider: parsed.data.provider,
        model: parsed.data.model,
        baseUrl: parsed.data.baseUrl ?? null,
        autoTriggerOnArchive: parsed.data.autoTriggerOnArchive,
        apiKeyUpdated: Boolean(parsed.data.apiKey?.trim()),
        targetUsername: targetUser.username,
      },
    });
    return c.json({ settings });
  } catch (error) {
    return c.json({ error: { code: 'AI_SETTINGS_SAVE_FAILED', message: error instanceof Error ? error.message : '保存 AI 配置失败' } }, 400);
  }
});

aiRoutes.post('/ai/admin/users/:userId/settings/test', requireAdmin, async (c) => {
  const userId = Number(c.req.param('userId'));
  if (!Number.isInteger(userId) || userId <= 0) {
    return c.json({ error: { code: 'BAD_REQUEST', message: '用户 ID 无效' } }, 400);
  }
  if (!await findAdminAiTargetUser(userId)) {
    return c.json({ error: { code: 'USER_NOT_FOUND', message: '用户不存在' } }, 404);
  }

  const parsed = adminSettingsTestInput.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: { code: 'AI_SETTINGS_INVALID', message: 'AI 测试参数无效' } }, 400);

  try {
    const config = parsed.data.apiKey && parsed.data.provider && parsed.data.model
      ? {
          provider: parsed.data.provider,
          model: parsed.data.model,
          baseUrl: parsed.data.baseUrl || null,
          apiKey: parsed.data.apiKey,
        }
      : await resolveUserAiRuntimeConfig(userId);
    if (!config) return c.json({ error: { code: 'AI_NOT_CONFIGURED', message: '目标用户尚未配置完整的模型信息' } }, 400);

    assertUserAiProvider(config.provider, config.baseUrl);
    if (config.baseUrl) await assertSafeAiBaseUrl(config.baseUrl);
    const startedAt = Date.now();
    await callUserAi(config, '你是连通性测试助手。', '请只回复 OK', 16);
    return c.json({ ok: true, latencyMs: Date.now() - startedAt });
  } catch (error) {
    return c.json({ error: { code: 'AI_SETTINGS_TEST_FAILED', message: error instanceof Error ? error.message : 'AI 连通性测试失败' } }, 400);
  }
});

aiRoutes.post('/ai/admin/users/:userId/models/discover', requireAdmin, async (c) => {
  const userId = Number(c.req.param('userId'));
  if (!Number.isInteger(userId) || userId <= 0) {
    return c.json({ error: { code: 'BAD_REQUEST', message: '用户 ID 无效' } }, 400);
  }
  if (!await findAdminAiTargetUser(userId)) {
    return c.json({ error: { code: 'USER_NOT_FOUND', message: '用户不存在' } }, 404);
  }

  const parsed = adminDiscoverModelsInput.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return c.json({ error: { code: 'AI_DISCOVERY_INVALID', message: '模型发现参数无效' } }, 400);

  try {
    const config = parsed.data.apiKey
      ? {
          provider: parsed.data.provider,
          baseUrl: parsed.data.baseUrl || null,
          apiKey: parsed.data.apiKey,
        }
      : await resolveUserAiRuntimeConfig(userId);
    if (!config) return c.json({ error: { code: 'AI_NOT_CONFIGURED', message: '目标用户尚未配置完整的模型信息' } }, 400);

    assertUserAiProvider(config.provider, config.baseUrl);
    if (config.baseUrl) await assertSafeAiBaseUrl(config.baseUrl);
    return c.json(await listAiModels(config));
  } catch (error) {
    return c.json({ error: { code: 'AI_DISCOVERY_FAILED', message: error instanceof Error ? error.message : '获取模型列表失败' } }, 400);
  }
});

aiRoutes.get('/ai/jobs', requireAuth, async (c) => {
  const userId = getCurrentUser(c).id as number;
  const page = Number(c.req.query('page') || 1);
  const perPage = Number(c.req.query('perPage') || 20);
  const result = await listAiGenerationJobs(
    userId,
    Number.isFinite(perPage) ? perPage : 20,
    Number.isFinite(page) && page > 0 ? (page - 1) * perPage : 0,
  );
  return c.json(result);
});

aiRoutes.post('/ai/jobs/:id/retry', requireAuth, async (c) => {
  const userId = getCurrentUser(c).id as number;
  const jobId = Number(c.req.param('id'));
  if (!Number.isInteger(jobId) || jobId <= 0) {
    return c.json({ error: { code: 'AI_JOB_NOT_FOUND', message: 'AI 任务不存在' } }, 404);
  }
  try {
    await retryAiGenerationJob(userId, jobId);
    return c.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === 'AI_JOB_NOT_FOUND' || message === 'AI_JOB_NOT_RETRYABLE') {
      return c.json({ error: { code: 'AI_JOB_NOT_FOUND', message: 'AI 任务不存在或不可重试' } }, 404);
    }
    return c.json({ error: { code: 'AI_RETRY_FAILED', message: 'AI 任务重试失败' } }, 400);
  }
});
