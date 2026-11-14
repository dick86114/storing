import { Hono } from 'hono';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { articleDeepAnalyses } from '../db/schema.js';
import { requireAuth, getCurrentUser } from '../middleware/auth.js';
import { getArticleRecord } from './articles.js';
import {
  enqueueDeepAnalysis,
  getDeepAnalysisSummary,
  getDeepAnalysisVersions,
  restoreDeepAnalysisVersion,
} from '../services/deep-analysis.service.js';
import {
  listUserNotifications,
  markUserNotificationRead,
} from '../services/user-notification.service.js';

export const deepAnalysisRoutes = new Hono();

deepAnalysisRoutes.post('/articles/:id/deep-analysis', requireAuth, async (c) => {
  const idParam = c.req.param('id');
  const articleId = idParam === undefined ? NaN : parseInt(idParam, 10);
  if (!idParam || !Number.isInteger(articleId) || articleId <= 0) {
    return c.json({ error: { code: 'BAD_REQUEST', message: '文章 ID 无效' } }, 400);
  }
  const userId = getCurrentUser(c).id as number;
  const article = await getArticleRecord(articleId, userId);
  if (!article) {
    return c.json({ error: { code: 'NOT_FOUND', message: '文章不在你的资料库中' } }, 404);
  }
  try {
    const result = await enqueueDeepAnalysis(userId, articleId);
    return c.json({ articleId, ...result });
  } catch (error) {
    const rawCode = error instanceof Error ? error.message : 'DEEP_ANALYSIS_FAILED';
    const code = rawCode.split(':', 1)[0] || 'DEEP_ANALYSIS_FAILED';
    const aiSecretInvalid = code === 'USER_AI_ENCRYPTION_KEY_MISSING'
      || code === 'USER_AI_ENCRYPTION_KEY_INVALID'
      || code === 'USER_AI_SECRET_DECRYPT_FAILED';
    const message = code === 'AI_NOT_CONFIGURED'
      ? '请先配置 AI 模型'
      : aiSecretInvalid
        ? '本机 AI Key 加密密钥与已保存配置不匹配，请到设置页重新保存模型 API Key'
        : code === 'DEEP_ANALYSIS_BODY_NOT_FOUND'
          ? '文章正文缺失，请先重新抓取'
          : '深度解析提交失败';
    return c.json(
      { error: { code, message } },
      code === 'AI_NOT_CONFIGURED' ? 400 : aiSecretInvalid ? 409 : 422,
    );
  }
});

deepAnalysisRoutes.get('/articles/:id/deep-analysis', requireAuth, async (c) => {
  const idParam = c.req.param('id');
  const articleId = idParam === undefined ? NaN : parseInt(idParam, 10);
  if (!idParam || !Number.isInteger(articleId) || articleId <= 0) {
    return c.json({ error: { code: 'BAD_REQUEST', message: '文章 ID 无效' } }, 400);
  }
  const userId = getCurrentUser(c).id as number;
  const article = await getArticleRecord(articleId, userId);
  if (!article) return c.json({ error: { code: 'NOT_FOUND', message: '文章不在你的资料库中' } }, 404);
  const summary = await getDeepAnalysisSummary(userId, articleId);
  const [report] = await db
    .select({
      version: articleDeepAnalyses.version,
      reportJson: articleDeepAnalyses.reportJson,
      reportMarkdown: articleDeepAnalyses.reportMarkdown,
      providerSnapshot: articleDeepAnalyses.providerSnapshot,
      modelSnapshot: articleDeepAnalyses.modelSnapshot,
      promptTokens: articleDeepAnalyses.promptTokens,
      completionTokens: articleDeepAnalyses.completionTokens,
      totalTokens: articleDeepAnalyses.totalTokens,
      contentTruncated: articleDeepAnalyses.contentTruncated,
      attempts: articleDeepAnalyses.attempts,
      durationMs: articleDeepAnalyses.durationMs,
      generatedAt: articleDeepAnalyses.finishedAt,
    })
    .from(articleDeepAnalyses)
    .where(and(
      eq(articleDeepAnalyses.userId, userId),
      eq(articleDeepAnalyses.articleId, articleId),
      eq(articleDeepAnalyses.isCurrent, true),
    ))
    .limit(1);
  return c.json({ report: report ?? null, summary });
});

deepAnalysisRoutes.get('/articles/:id/deep-analysis/versions', requireAuth, async (c) => {
  const idParam = c.req.param('id');
  const articleId = idParam === undefined ? NaN : parseInt(idParam, 10);
  if (!idParam || !Number.isInteger(articleId) || articleId <= 0) {
    return c.json({ error: { code: 'BAD_REQUEST', message: '文章 ID 无效' } }, 400);
  }
  const userId = getCurrentUser(c).id as number;
  const article = await getArticleRecord(articleId, userId);
  if (!article) return c.json({ error: { code: 'NOT_FOUND', message: '文章不在你的资料库中' } }, 404);
  const versions = await getDeepAnalysisVersions(userId, articleId);
  return c.json({ versions });
});

deepAnalysisRoutes.post('/articles/:id/deep-analysis/:version/restore', requireAuth, async (c) => {
  const idParam = c.req.param('id');
  const versionParam = c.req.param('version');
  const articleId = idParam === undefined ? NaN : parseInt(idParam, 10);
  const version = versionParam === undefined ? NaN : parseInt(versionParam, 10);
  if (!idParam || !versionParam || !Number.isInteger(articleId) || articleId <= 0
    || !Number.isInteger(version) || version <= 0) {
    return c.json({ error: { code: 'BAD_REQUEST', message: '参数无效' } }, 400);
  }
  const userId = getCurrentUser(c).id as number;
  const article = await getArticleRecord(articleId, userId);
  if (!article) return c.json({ error: { code: 'NOT_FOUND', message: '文章不在你的资料库中' } }, 404);
  try {
    await restoreDeepAnalysisVersion(userId, articleId, version);
    const summary = await getDeepAnalysisSummary(userId, articleId);
    return c.json({ articleId, version, summary, message: '当前版本已恢复' });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'DEEP_ANALYSIS_RESTORE_FAILED';
    if (code === 'DEEP_ANALYSIS_VERSION_NOT_FOUND') {
      return c.json({ error: { code, message: '报告版本不存在' } }, 404);
    }
    return c.json({ error: { code: 'DEEP_ANALYSIS_RESTORE_FAILED', message: '报告版本恢复失败' } }, 500);
  }
});

deepAnalysisRoutes.get('/notifications', requireAuth, async (c) => {
  const userId = getCurrentUser(c).id as number;
  const limit = parseInt(c.req.query('limit') || '50');
  const result = await listUserNotifications(userId, limit);
  return c.json(result);
});

deepAnalysisRoutes.patch('/notifications/:id/read', requireAuth, async (c) => {
  const idParam = c.req.param('id');
  const notificationId = idParam === undefined ? NaN : parseInt(idParam, 10);
  if (!idParam || !Number.isInteger(notificationId) || notificationId <= 0) {
    return c.json({ error: { code: 'BAD_REQUEST', message: '通知 ID 无效' } }, 400);
  }
  const userId = getCurrentUser(c).id as number;
  try {
    await markUserNotificationRead(userId, notificationId);
    return c.json({ ok: true });
  } catch (error) {
    const code = error instanceof Error ? error.message : 'USER_NOTIFICATION_ERROR';
    if (code === 'USER_NOTIFICATION_NOT_FOUND') {
      return c.json({ error: { code, message: '通知不存在' } }, 404);
    }
    return c.json({ error: { code: 'USER_NOTIFICATION_ERROR', message: '通知更新失败' } }, 500);
  }
});
