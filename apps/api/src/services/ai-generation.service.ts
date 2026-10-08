import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { aiGenerationJobs, articleMetadata } from '../db/schema.js';
import { generateCombinedArticleAi } from './ai.service.js';
import { resolveUserAiRuntimeConfig } from './user-ai-settings.service.js';
import { getUserAiSettingsSummary } from './user-ai-settings.service.js';

export type AiGenerationStatus =
  | 'not_generated'
  | 'disabled'
  | 'not_configured'
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'failed';

export type AiGenerationTrigger = 'archive' | 'manual' | 'admin' | 'mcp_summary';

export type AiGenerationJobSummary = {
  id: number;
  articleId: number;
  triggerType: AiGenerationTrigger;
  status: AiGenerationStatus;
  errorCode: string | null;
  errorMessage: string | null;
  provider: string;
  model: string;
  totalTokens: number | null;
  contentTruncated: boolean;
  createdAt: Date;
  finishedAt: Date | null;
};

export type AiGenerationUsageSummary = {
  totalJobs: number;
  succeededJobs: number;
  failedJobs: number;
  totalTokens: number;
};

export const AI_GENERATION_MAX_ATTEMPTS = 3;

type AiGenerationJobRow = typeof aiGenerationJobs.$inferSelect;
type AiGenerationDatabase = Pick<typeof db, 'update'>;

function normalizeJob(row: AiGenerationJobRow): AiGenerationJobSummary {
  return {
    id: row.id,
    articleId: row.articleId,
    triggerType: row.triggerType as AiGenerationTrigger,
    status: row.status as AiGenerationStatus,
    errorCode: row.errorCode,
    errorMessage: row.errorMessage,
    provider: row.providerSnapshot,
    model: row.modelSnapshot,
    totalTokens: row.totalTokens,
    contentTruncated: row.contentTruncated,
    createdAt: row.createdAt,
    finishedAt: row.finishedAt,
  };
}

function errorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  return String(error);
}

function errorCodeFromError(error: unknown): string {
  const message = errorText(error);
  const match = message.match(/^(AI_[A-Z0-9_]+)(?::|$)/);
  return match?.[1] ?? 'AI_GENERATION_FAILED';
}

export function shouldRetryAiError(error: unknown): boolean {
  const message = errorText(error);
  if (/^(AI_UNAUTHORIZED|AI_FORBIDDEN|AI_PAYMENT_REQUIRED|AI_MODEL_NOT_FOUND)(?::|$)/.test(message)) {
    return false;
  }
  return /AI_RATE_LIMITED|AI_PROVIDER_UNAVAILABLE|AI_NETWORK_FAILED|AI_TIMEOUT|\b429\b|\b5\d\d\b/.test(message);
}

export async function ensureAiGenerationSchema(): Promise<void> {
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS ai_generation_jobs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
      trigger_type TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      provider_snapshot TEXT NOT NULL,
      model_snapshot TEXT NOT NULL,
      base_url_snapshot TEXT,
      include_category BOOLEAN NOT NULL DEFAULT TRUE,
      error_code TEXT,
      error_message TEXT,
      attempts INTEGER NOT NULL DEFAULT 0,
      prompt_tokens INTEGER,
      completion_tokens INTEGER,
      total_tokens INTEGER,
      content_truncated BOOLEAN NOT NULL DEFAULT FALSE,
      next_run_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      started_at TIMESTAMP,
      finished_at TIMESTAMP
    )
  `));
  await db.execute(sql.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS ai_generation_jobs_user_article_active_idx
      ON ai_generation_jobs(user_id, article_id)
      WHERE status IN ('queued', 'running')
  `));
  await db.execute(sql.raw(`
    CREATE INDEX IF NOT EXISTS ai_generation_jobs_user_created_idx
      ON ai_generation_jobs(user_id, created_at DESC)
  `));
  await db.execute(sql.raw(`
    CREATE INDEX IF NOT EXISTS ai_generation_jobs_status_idx
      ON ai_generation_jobs(status, created_at)
  `));
  await db.execute(sql.raw(`
    ALTER TABLE article_metadata ADD COLUMN IF NOT EXISTS ai_status TEXT NOT NULL DEFAULT 'not_generated'
  `));
  await db.execute(sql.raw(`
    ALTER TABLE article_metadata ADD COLUMN IF NOT EXISTS ai_error_code TEXT
  `));
  await db.execute(sql.raw(`
    ALTER TABLE article_metadata ADD COLUMN IF NOT EXISTS ai_error_message TEXT
  `));
  await db.execute(sql.raw(`
    ALTER TABLE article_metadata ADD COLUMN IF NOT EXISTS ai_model TEXT
  `));
  await db.execute(sql.raw(`
    ALTER TABLE article_metadata ADD COLUMN IF NOT EXISTS ai_total_tokens INTEGER
  `));
  await db.execute(sql.raw(`
    ALTER TABLE article_metadata ADD COLUMN IF NOT EXISTS ai_content_truncated BOOLEAN NOT NULL DEFAULT FALSE
  `));
  await db.execute(sql.raw(`
    UPDATE article_metadata
    SET ai_status = 'succeeded'
    WHERE ai_status = 'not_generated'
      AND (ai_summary IS NOT NULL OR ai_tags IS NOT NULL OR category_id IS NOT NULL)
  `));
}

async function setArticleAiStatus(
  database: AiGenerationDatabase,
  userId: number,
  articleId: number,
  status: AiGenerationStatus,
  errorCode?: string | null,
  errorMessage?: string | null,
) {
  await database.update(articleMetadata)
    .set({
      aiStatus: status,
      aiErrorCode: errorCode ?? null,
      aiErrorMessage: errorMessage ?? null,
      updatedAt: new Date(),
    })
    .where(and(eq(articleMetadata.articleId, articleId), eq(articleMetadata.userId, userId)));
}

export async function setAiArticleStatus(
  userId: number,
  articleId: number,
  status: AiGenerationStatus,
  errorCode?: string,
  errorMessage?: string,
): Promise<void> {
  await setArticleAiStatus(db, userId, articleId, status, errorCode ?? null, errorMessage ?? null);
}

export async function enqueueAiGeneration(input: {
  userId: number;
  articleId: number;
  triggerType: AiGenerationTrigger;
  includeCategory: boolean;
}): Promise<{ jobId: number; status: AiGenerationStatus }> {
  await ensureAiGenerationSchema();
  const settings = await getUserAiSettingsSummary(input.userId);
  if (input.triggerType === 'archive' && settings && !settings.autoTriggerOnArchive) {
    await setAiArticleStatus(input.userId, input.articleId, 'disabled');
    return { jobId: 0, status: 'disabled' };
  }

  const runtimeConfig = await resolveUserAiRuntimeConfig(input.userId);
  if (!runtimeConfig) {
    await setAiArticleStatus(input.userId, input.articleId, 'not_configured');
    return { jobId: 0, status: 'not_configured' };
  }

  const [activeJob] = await db
    .select({ id: aiGenerationJobs.id, status: aiGenerationJobs.status })
    .from(aiGenerationJobs)
    .where(and(
      eq(aiGenerationJobs.userId, input.userId),
      eq(aiGenerationJobs.articleId, input.articleId),
      sql`${aiGenerationJobs.status} IN ('queued', 'running')`,
    ))
    .limit(1);
  if (activeJob) {
    await setAiArticleStatus(input.userId, input.articleId, activeJob.status as AiGenerationStatus);
    return { jobId: activeJob.id, status: activeJob.status as AiGenerationStatus };
  }

  const [job] = await db.insert(aiGenerationJobs).values({
    userId: input.userId,
    articleId: input.articleId,
    triggerType: input.triggerType,
    providerSnapshot: runtimeConfig.provider,
    modelSnapshot: runtimeConfig.model,
    baseUrlSnapshot: runtimeConfig.baseUrl,
    includeCategory: input.includeCategory,
  }).returning({ id: aiGenerationJobs.id });
  await setAiArticleStatus(input.userId, input.articleId, 'queued');
  return { jobId: job.id, status: 'queued' };
}

async function claimNextAiGenerationJob(): Promise<AiGenerationJobRow | null> {
  return db.transaction(async (database) => {
    const result = await database.execute(sql`
      SELECT *
      FROM ai_generation_jobs
      WHERE status = 'queued'
        AND attempts < ${AI_GENERATION_MAX_ATTEMPTS}
        AND (next_run_at IS NULL OR next_run_at <= NOW())
        AND NOT EXISTS (
          SELECT 1
          FROM ai_generation_jobs AS running
          WHERE running.user_id = ai_generation_jobs.user_id
            AND running.status = 'running'
        )
      ORDER BY created_at
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    `);
    const job = result.rows[0] as AiGenerationJobRow | undefined;
    if (!job) return null;
    const [claimed] = await database
      .update(aiGenerationJobs)
      .set({
        status: 'running',
        attempts: job.attempts + 1,
        startedAt: new Date(),
        finishedAt: null,
        updatedAt: new Date(),
      })
      .where(eq(aiGenerationJobs.id, job.id))
      .returning();
    await setArticleAiStatus(database, claimed.userId, claimed.articleId, 'running');
    return claimed;
  });
}

async function completeAiGenerationJob(
  job: AiGenerationJobRow,
  result: Awaited<ReturnType<typeof generateCombinedArticleAi>>,
) {
  await db.transaction(async (database) => {
    const metadataValues: Partial<typeof articleMetadata.$inferInsert> = {
      aiSummary: result.summary,
      aiTags: result.tags,
      aiStatus: 'succeeded',
      aiErrorCode: null,
      aiErrorMessage: null,
      aiModel: result.modelVersion,
      aiTotalTokens: result.totalTokens,
      aiContentTruncated: result.contentTruncated,
      updatedAt: new Date(),
    };
    if (job.includeCategory && result.categoryId !== null) {
      metadataValues.categoryId = result.categoryId;
      metadataValues.categorySource = 'ai';
      metadataValues.categoryConfidence = result.confidence === null ? null : String(result.confidence);
      metadataValues.categoryReason = result.reason;
      metadataValues.categoryReviewStatus = (result.confidence ?? 0) >= 0.75 ? 'confirmed' : 'needs_review';
      metadataValues.categoryModelVersion = result.modelVersion;
    }
    await database.update(articleMetadata)
      .set(metadataValues)
      .where(and(
        eq(articleMetadata.articleId, job.articleId),
        eq(articleMetadata.userId, job.userId),
      ));
    await database.update(aiGenerationJobs)
      .set({
        status: 'succeeded',
        errorCode: null,
        errorMessage: null,
        promptTokens: result.promptTokens,
        completionTokens: result.completionTokens,
        totalTokens: result.totalTokens,
        contentTruncated: result.contentTruncated,
        finishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(aiGenerationJobs.id, job.id));
  });
}

async function failAiGenerationJob(job: AiGenerationJobRow, error: unknown) {
  const errorCode = errorCodeFromError(error);
  const errorMessage = errorText(error).slice(0, 1000);
  const canRetry = shouldRetryAiError(error) && job.attempts < AI_GENERATION_MAX_ATTEMPTS;
  if (canRetry) {
    await db.update(aiGenerationJobs).set({
      status: 'queued',
      errorCode,
      errorMessage,
      nextRunAt: new Date(Date.now() + Math.pow(2, job.attempts) * 1000),
      finishedAt: null,
      updatedAt: new Date(),
    }).where(eq(aiGenerationJobs.id, job.id));
    return;
  }
  await db.update(aiGenerationJobs).set({
    status: 'failed',
    errorCode,
    errorMessage,
    nextRunAt: null,
    finishedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(aiGenerationJobs.id, job.id));
  await setArticleAiStatus(db, job.userId, job.articleId, 'failed', errorCode, errorMessage);
}

export async function runAiGenerationWorkers(): Promise<void> {
  for (;;) {
    const job = await claimNextAiGenerationJob();
    if (!job) return;
    try {
      const result = await generateCombinedArticleAi(job.userId, job.articleId, {
        includeCategory: job.includeCategory,
      });
      await completeAiGenerationJob(job, result);
    } catch (error) {
      await failAiGenerationJob(job, error);
    }
  }
}

export async function resumeAiGenerationJobs(): Promise<void> {
  await db.update(aiGenerationJobs)
    .set({ status: 'queued', startedAt: null, updatedAt: new Date() })
    .where(eq(aiGenerationJobs.status, 'running'));
  await runAiGenerationWorkers();
}

export async function retryAiGenerationJob(userId: number, jobId: number): Promise<void> {
  const [job] = await db
    .select()
    .from(aiGenerationJobs)
    .where(and(eq(aiGenerationJobs.id, jobId), eq(aiGenerationJobs.userId, userId)))
    .limit(1);
  if (!job) throw new Error('AI_JOB_NOT_FOUND');
  if (job.status !== 'failed') throw new Error('AI_JOB_NOT_RETRYABLE');
  await db.update(aiGenerationJobs).set({
    status: 'queued',
    attempts: 0,
    errorCode: null,
    errorMessage: null,
    nextRunAt: null,
    finishedAt: null,
    updatedAt: new Date(),
  }).where(eq(aiGenerationJobs.id, job.id));
  await setAiArticleStatus(userId, job.articleId, 'queued');
  void runAiGenerationWorkers().catch((error) => console.error('AI generation retry worker failed:', error));
}

export async function listAiGenerationJobs(
  userId: number,
  limit: number,
  offset: number,
): Promise<{ jobs: AiGenerationJobSummary[]; total: number; usage: AiGenerationUsageSummary }> {
  const safeLimit = Math.max(1, Math.min(50, Math.floor(limit) || 20));
  const safeOffset = Math.max(0, Math.floor(offset) || 0);
  const rows = await db
    .select()
    .from(aiGenerationJobs)
    .where(eq(aiGenerationJobs.userId, userId))
    .orderBy(desc(aiGenerationJobs.createdAt))
    .limit(safeLimit)
    .offset(safeOffset);
  const [usage] = await db
    .select({
      totalJobs: sql<number>`COUNT(*)::int`,
      succeededJobs: sql<number>`COUNT(*) FILTER (WHERE status = 'succeeded')::int`,
      failedJobs: sql<number>`COUNT(*) FILTER (WHERE status = 'failed')::int`,
      totalTokens: sql<number>`COALESCE(SUM(total_tokens), 0)::int`,
    })
    .from(aiGenerationJobs)
    .where(eq(aiGenerationJobs.userId, userId));

  return {
    jobs: rows.map(normalizeJob),
    total: usage?.totalJobs ?? 0,
    usage: {
      totalJobs: usage?.totalJobs ?? 0,
      succeededJobs: usage?.succeededJobs ?? 0,
      failedJobs: usage?.failedJobs ?? 0,
      totalTokens: usage?.totalTokens ?? 0,
    },
  };
}
