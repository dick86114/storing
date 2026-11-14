import { createHash } from 'node:crypto';
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { asc } from 'drizzle-orm';
import { getArticleContent } from './reader.service.js';
import {
  buildDeepAnalysisPrompt,
  parseDeepAnalysisReport,
  renderDeepAnalysisMarkdown,
  type DeepAnalysisReport,
} from './deep-analysis-ai.service.js';
import { callUserAi } from './ai-provider.service.js';
import { resolveUserAiRuntimeConfig } from './user-ai-settings.service.js';
import { createDeepAnalysisNotification } from './user-notification.service.js';
import { db } from '../db/index.js';
import { articleDeepAnalyses, articles } from '../db/schema.js';

export type DeepAnalysisStatus =
  | 'not_generated'
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed';

export type DeepAnalysisSummary = {
  hasDeepAnalysis: boolean;
  status: DeepAnalysisStatus;
  version: number | null;
  generatedAt: Date | null;
  stale: boolean;
  errorCode: string | null;
};

export const DEEP_ANALYSIS_MAX_ATTEMPTS = 3;

const notGeneratedSummary: DeepAnalysisSummary = {
  hasDeepAnalysis: false,
  status: 'not_generated',
  version: null,
  generatedAt: null,
  stale: false,
  errorCode: null,
};

export async function ensureDeepAnalysisSchema(): Promise<void> {
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS article_deep_analyses (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'queued',
      content_hash TEXT NOT NULL,
      report_json JSONB,
      report_markdown TEXT,
      model_snapshot TEXT NOT NULL,
      base_url_snapshot TEXT,
      prompt_tokens INTEGER,
      completion_tokens INTEGER,
      total_tokens INTEGER,
      content_truncated BOOLEAN NOT NULL DEFAULT FALSE,
      is_current BOOLEAN NOT NULL DEFAULT FALSE,
      version INTEGER NOT NULL DEFAULT 1,
      error_code TEXT,
      error_message TEXT,
      attempts INTEGER NOT NULL DEFAULT 0,
      next_run_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      started_at TIMESTAMP,
      finished_at TIMESTAMP
    )
  `));
  await db.execute(sql.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS article_deep_analyses_user_article_active_idx
      ON article_deep_analyses(user_id, article_id)
      WHERE status IN ('queued', 'running')
  `));
  await db.execute(sql.raw(`
    CREATE INDEX IF NOT EXISTS article_deep_analyses_user_status_idx
      ON article_deep_analyses(user_id, status, created_at)
  `));
}

function normalizeSummary(row: typeof articleDeepAnalyses.$inferSelect): DeepAnalysisSummary {
  return {
    hasDeepAnalysis: row.status === 'succeeded',
    status: row.status as DeepAnalysisStatus,
    version: row.version,
    generatedAt: row.finishedAt,
    stale: row.status === 'succeeded' && !row.isCurrent,
    errorCode: row.errorCode,
  };
}

export async function getDeepAnalysisSummary(
  userId: number,
  articleId: number,
): Promise<DeepAnalysisSummary> {
  const [row] = await db
    .select()
    .from(articleDeepAnalyses)
    .where(and(
      eq(articleDeepAnalyses.userId, userId),
      eq(articleDeepAnalyses.articleId, articleId),
    ))
    .orderBy(desc(articleDeepAnalyses.createdAt))
    .limit(1);
  return row ? normalizeSummary(row) : notGeneratedSummary;
}

export async function attachDeepAnalysisSummaries(
  userId: number,
  articleIds: number[],
): Promise<Map<number, DeepAnalysisSummary>> {
  const uniqueIds = [...new Set(articleIds)]
    .filter((articleId) => Number.isInteger(articleId) && articleId > 0);
  const summaries = new Map<number, DeepAnalysisSummary>();
  if (uniqueIds.length === 0) return summaries;

  const rows = await db
    .select()
    .from(articleDeepAnalyses)
    .where(and(
      eq(articleDeepAnalyses.userId, userId),
      inArray(articleDeepAnalyses.articleId, uniqueIds),
    ))
    .orderBy(desc(articleDeepAnalyses.createdAt));
  for (const articleId of uniqueIds) {
    const row = rows.find((item) => item.articleId === articleId);
    summaries.set(articleId, row ? normalizeSummary(row) : notGeneratedSummary);
  }
  return summaries;
}

export function shouldRetryDeepAnalysisError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  if (/^(AI_UNAUTHORIZED|AI_FORBIDDEN|AI_PAYMENT_REQUIRED|AI_MODEL_NOT_FOUND)(?::|$)/.test(message)) {
    return false;
  }
  return /AI_RATE_LIMITED|AI_PROVIDER_UNAVAILABLE|AI_NETWORK_FAILED|AI_TIMEOUT|\b429\b|\b5\d\d\b/.test(message);
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function errorCodeFromError(error: unknown): string {
  return errorText(error).match(/^(AI_[A-Z0-9_]+)(?::|$)/)?.[1] ?? 'DEEP_ANALYSIS_FAILED';
}

export async function enqueueDeepAnalysis(
  userId: number,
  articleId: number,
): Promise<{ jobId: number; status: DeepAnalysisStatus }> {
  const startWorkers = () => {
    void runDeepAnalysisWorkers().catch((error) =>
      console.error('深度报告任务执行失败:', errorText(error)),
    );
  };
  await ensureDeepAnalysisSchema();
  const runtimeConfig = await resolveUserAiRuntimeConfig(userId);
  if (!runtimeConfig) {
    throw new Error('AI_NOT_CONFIGURED');
  }

  const [activeJob] = await db
    .select({ id: articleDeepAnalyses.id, status: articleDeepAnalyses.status })
    .from(articleDeepAnalyses)
    .where(and(
      eq(articleDeepAnalyses.userId, userId),
      eq(articleDeepAnalyses.articleId, articleId),
      sql`${articleDeepAnalyses.status} IN ('queued', 'running')`,
    ))
    .limit(1);
  if (activeJob) {
    startWorkers();
    return { jobId: activeJob.id, status: activeJob.status as DeepAnalysisStatus };
  }

  const [article] = await db
    .select({
      summary: articles.summary,
      contentMarkdown: articles.contentMarkdown,
      contentHtml: articles.contentHtml,
    })
    .from(articles)
    .where(eq(articles.id, articleId))
    .limit(1);
  if (!article) throw new Error('DEEP_ANALYSIS_ARTICLE_NOT_FOUND');

  const cachedMarkdown = await getArticleContent(articleId, 'markdown', 'desktop', userId).catch(() => null);
  const cachedHtml = await getArticleContent(articleId, 'html', 'desktop', userId).catch(() => null);
  const content = cachedMarkdown || article.contentMarkdown || cachedHtml || article.contentHtml || article.summary || '';
  if (!content) throw new Error('DEEP_ANALYSIS_BODY_NOT_FOUND');
  const contentHash = createHash('sha256').update(content).digest('hex');
  const previousVersion = await db
    .select({ version: articleDeepAnalyses.version })
    .from(articleDeepAnalyses)
    .where(and(
      eq(articleDeepAnalyses.userId, userId),
      eq(articleDeepAnalyses.articleId, articleId),
    ))
    .orderBy(desc(articleDeepAnalyses.version))
    .limit(1);

  const [job] = await db.insert(articleDeepAnalyses).values({
    userId,
    articleId,
    status: 'queued',
    contentHash,
    modelSnapshot: runtimeConfig.model,
    baseUrlSnapshot: runtimeConfig.baseUrl,
    version: (previousVersion[0]?.version ?? 0) + 1,
  }).returning({ id: articleDeepAnalyses.id });
  startWorkers();
  return { jobId: job.id, status: 'queued' };
}

async function claimNextDeepAnalysisJob() {
  const claimed = await db.transaction(async (database) => {
    const result = await database.execute(sql`
      SELECT *
      FROM article_deep_analyses
      WHERE status = 'queued'
        AND attempts < ${DEEP_ANALYSIS_MAX_ATTEMPTS}
        AND (next_run_at IS NULL OR next_run_at <= NOW())
        AND NOT EXISTS (
          SELECT 1
          FROM article_deep_analyses AS running
          WHERE running.user_id = article_deep_analyses.user_id
            AND running.status = 'running'
        )
      ORDER BY created_at
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    `);
    const job = result.rows[0] as typeof articleDeepAnalyses.$inferSelect | undefined;
    if (!job) return null;
    const [claimed] = await database
      .update(articleDeepAnalyses)
      .set({
        status: 'running',
        attempts: job.attempts + 1,
        startedAt: new Date(),
        finishedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(articleDeepAnalyses.id, job.id))
      .returning();
    return claimed;
  });
  return claimed;
}

async function buildArticleDeepInput(userId: number, articleId: number) {
  const [article] = await db
    .select({
      title: articles.title,
      summary: articles.summary,
      contentMarkdown: articles.contentMarkdown,
      contentHtml: articles.contentHtml,
    })
    .from(articles)
    .where(eq(articles.id, articleId))
    .limit(1);
  if (!article) throw new Error('DEEP_ANALYSIS_ARTICLE_NOT_FOUND');
  const cachedMarkdown = await getArticleContent(articleId, 'markdown', 'desktop', userId).catch(() => null);
  const cachedHtml = await getArticleContent(articleId, 'html', 'desktop', userId).catch(() => null);
  const content = cachedMarkdown || article.contentMarkdown || cachedHtml || article.contentHtml || article.summary || '';
  if (!content) throw new Error('DEEP_ANALYSIS_BODY_NOT_FOUND');
  return {
    title: article.title || '',
    summary: article.summary || '',
    content,
  };
}

async function completeDeepAnalysisJob(
  job: typeof articleDeepAnalyses.$inferSelect,
  report: DeepAnalysisReport,
  usage: {
    promptTokens: number | null;
    completionTokens: number | null;
    totalTokens: number | null;
  },
  contentTruncated: boolean,
) {
  await db.transaction(async (database) => {
    await database.update(articleDeepAnalyses)
      .set({ isCurrent: false })
      .where(and(
        eq(articleDeepAnalyses.userId, job.userId),
        eq(articleDeepAnalyses.articleId, job.articleId),
        eq(articleDeepAnalyses.isCurrent, true),
      ));
    await database.update(articleDeepAnalyses)
      .set({
        status: 'succeeded',
        reportJson: report,
        reportMarkdown: renderDeepAnalysisMarkdown(report),
        isCurrent: true,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        totalTokens: usage.totalTokens,
        contentTruncated,
        errorCode: null,
        errorMessage: null,
        finishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(articleDeepAnalyses.id, job.id));
  });
}

async function failDeepAnalysisJob(job: typeof articleDeepAnalyses.$inferSelect, error: unknown) {
  const errorCode = errorCodeFromError(error);
  const errorMessage = errorText(error).slice(0, 1000);
  const canRetry = shouldRetryDeepAnalysisError(error) && job.attempts < DEEP_ANALYSIS_MAX_ATTEMPTS;
  if (canRetry) {
    await db.update(articleDeepAnalyses).set({
      status: 'queued',
      errorCode,
      errorMessage,
      nextRunAt: new Date(Date.now() + Math.pow(2, job.attempts) * 1000),
      finishedAt: null,
      updatedAt: new Date(),
    }).where(eq(articleDeepAnalyses.id, job.id));
    return;
  }
  await db.update(articleDeepAnalyses).set({
    status: 'failed',
    errorCode,
    errorMessage,
    nextRunAt: null,
    finishedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(articleDeepAnalyses.id, job.id));
}

export async function runDeepAnalysisWorkers(): Promise<void> {
  for (;;) {
    const job = await claimNextDeepAnalysisJob();
    if (!job) return;
    try {
      const runtimeConfig = await resolveUserAiRuntimeConfig(job.userId);
      if (!runtimeConfig) throw new Error('AI_NOT_CONFIGURED');
      const input = await buildArticleDeepInput(job.userId, job.articleId);
      const prompt = buildDeepAnalysisPrompt(input);
      const aiResult = await callUserAi(runtimeConfig, prompt.system, prompt.user, prompt.maxTokens);
      const report = parseDeepAnalysisReport(aiResult.content);
      await completeDeepAnalysisJob(job, report, {
        promptTokens: aiResult.promptTokens,
        completionTokens: aiResult.completionTokens,
        totalTokens: aiResult.totalTokens,
      }, prompt.contentTruncated);
      const [articleTitle] = await db
        .select({ title: articles.title })
        .from(articles)
        .where(eq(articles.id, job.articleId))
        .limit(1);
      await createDeepAnalysisNotification({
        userId: job.userId,
        articleId: job.articleId,
        articleTitle: articleTitle?.title ?? null,
        reportVersion: job.version,
      });
    } catch (error) {
      await failDeepAnalysisJob(job, error);
    }
  }
}

export async function resumeDeepAnalysisJobs(): Promise<void> {
  await db.update(articleDeepAnalyses)
    .set({ status: 'queued', startedAt: null, updatedAt: new Date() })
    .where(eq(articleDeepAnalyses.status, 'running'));
  await runDeepAnalysisWorkers();
}

export async function retryDeepAnalysisJob(userId: number, jobId: number): Promise<void> {
  const [job] = await db
    .select()
    .from(articleDeepAnalyses)
    .where(and(
      eq(articleDeepAnalyses.id, jobId),
      eq(articleDeepAnalyses.userId, userId),
    ))
    .limit(1);
  if (!job) throw new Error('DEEP_ANALYSIS_JOB_NOT_FOUND');
  if (job.status !== 'failed') throw new Error('DEEP_ANALYSIS_JOB_NOT_RETRYABLE');
  await db.update(articleDeepAnalyses).set({
    status: 'queued',
    attempts: 0,
    errorCode: null,
    errorMessage: null,
    nextRunAt: null,
    finishedAt: null,
    updatedAt: new Date(),
  }).where(eq(articleDeepAnalyses.id, job.id));
  void runDeepAnalysisWorkers().catch((error) => console.error('深度报告重试失败:', errorText(error)));
}

export function getDeepAnalysisVersions(userId: number, articleId: number) {
  return db
    .select({
      id: articleDeepAnalyses.id,
      version: articleDeepAnalyses.version,
      status: articleDeepAnalyses.status,
      isCurrent: articleDeepAnalyses.isCurrent,
      contentTruncated: articleDeepAnalyses.contentTruncated,
      totalTokens: articleDeepAnalyses.totalTokens,
      generatedAt: articleDeepAnalyses.finishedAt,
      createdAt: articleDeepAnalyses.createdAt,
    })
    .from(articleDeepAnalyses)
    .where(and(
      eq(articleDeepAnalyses.userId, userId),
      eq(articleDeepAnalyses.articleId, articleId),
    ))
    .orderBy(asc(articleDeepAnalyses.version));
}

export async function restoreDeepAnalysisVersion(
  userId: number,
  articleId: number,
  version: number,
): Promise<void> {
  await db.transaction(async (database) => {
    const [target] = await database
      .select({ id: articleDeepAnalyses.id })
      .from(articleDeepAnalyses)
      .where(and(
        eq(articleDeepAnalyses.userId, userId),
        eq(articleDeepAnalyses.articleId, articleId),
        eq(articleDeepAnalyses.version, version),
        eq(articleDeepAnalyses.status, 'succeeded'),
      ))
      .limit(1);
    if (!target) throw new Error('DEEP_ANALYSIS_VERSION_NOT_FOUND');
    await database.update(articleDeepAnalyses)
      .set({ isCurrent: false, updatedAt: new Date() })
      .where(and(
        eq(articleDeepAnalyses.userId, userId),
        eq(articleDeepAnalyses.articleId, articleId),
        eq(articleDeepAnalyses.isCurrent, true),
      ));
    await database.update(articleDeepAnalyses)
      .set({ isCurrent: true, updatedAt: new Date() })
      .where(eq(articleDeepAnalyses.id, target.id));
  });
}
