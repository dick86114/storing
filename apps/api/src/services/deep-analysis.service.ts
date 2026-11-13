import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { articleDeepAnalyses } from '../db/schema.js';

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
