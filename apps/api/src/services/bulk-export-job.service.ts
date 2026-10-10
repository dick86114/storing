import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, rm, stat, unlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import { Readable } from 'node:stream';
import { finished } from 'node:stream/promises';

import { ZipArchive as Archiver } from 'archiver';
import { and, eq, inArray, isNotNull, lt, sql } from 'drizzle-orm';

import { db } from '../db/index.js';
import { articles, articleMetadata, bulkExportJobs, categories } from '../db/schema.js';
import {
  buildExportEntryPath,
  buildExportManifest,
  buildObsidianMarkdown,
  type BulkExportArticleInput,
} from './article-bulk-export.js';
import type { ArticleBulkIssue, BulkExportFormat, BulkExportJob } from '@storing/shared';

const BULK_EXPORT_ROOT = path.join(tmpdir(), 'storing-bulk-exports');
const BULK_EXPORT_TTL_HOURS = 24;

type BulkExportJobRow = typeof bulkExportJobs.$inferSelect;
type BulkExportFailureDetail = Array<ArticleBulkIssue & { title?: string | null }>;

function normalizeJob(row: BulkExportJobRow): BulkExportJob {
  return {
    id: row.id,
    format: row.format as BulkExportFormat,
    status: row.status as BulkExportJob['status'],
    requestedCount: row.requestedCount,
    succeededCount: row.succeededCount,
    failedCount: row.failedCount,
    downloadUrl: row.status === 'succeeded' ? `/api/v1/articles/bulk-export/${row.id}/download` : null,
    createdAt: row.createdAt.toISOString(),
    finishedAt: row.finishedAt?.toISOString() ?? null,
    expiresAt: row.expiresAt.toISOString(),
  };
}

export async function ensureBulkExportSchema(): Promise<void> {
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS bulk_export_jobs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      format TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'queued',
      requested_count INTEGER NOT NULL,
      article_ids JSONB NOT NULL,
      include_ai BOOLEAN NOT NULL DEFAULT TRUE,
      organize_by_category BOOLEAN NOT NULL DEFAULT TRUE,
      succeeded_count INTEGER NOT NULL DEFAULT 0,
      failed_count INTEGER NOT NULL DEFAULT 0,
      failure_detail JSONB,
      file_path TEXT NOT NULL,
      file_name TEXT NOT NULL,
      file_size INTEGER,
      error_message TEXT,
      expires_at TIMESTAMP NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
      finished_at TIMESTAMP
    )
  `));
  await db.execute(sql.raw(`
    ALTER TABLE bulk_export_jobs ADD COLUMN IF NOT EXISTS article_ids JSONB NOT NULL DEFAULT '[]'::jsonb;
    ALTER TABLE bulk_export_jobs ADD COLUMN IF NOT EXISTS include_ai BOOLEAN NOT NULL DEFAULT TRUE;
    ALTER TABLE bulk_export_jobs ADD COLUMN IF NOT EXISTS organize_by_category BOOLEAN NOT NULL DEFAULT TRUE;
  `));
  await db.execute(sql.raw(`
    CREATE INDEX IF NOT EXISTS bulk_export_jobs_user_created_idx
      ON bulk_export_jobs (user_id, created_at)
  `));
  await db.execute(sql.raw(`
    CREATE INDEX IF NOT EXISTS bulk_export_jobs_expires_idx
      ON bulk_export_jobs (expires_at)
  `));
}

function normalizeArticleIds(value: unknown): number[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const ids: number[] = [];
  for (const item of value) {
    const id = typeof item === 'number' ? item : Number(item);
    if (!Number.isSafeInteger(id) || id <= 0) return null;
    if (!ids.includes(id)) ids.push(id);
  }
  return ids.length > 200 ? null : ids;
}

export async function createBulkExportJob(
  userId: number,
  input: {
    articleIds: unknown;
    format: unknown;
    includeAi: boolean;
    organizeByCategory: boolean;
  },
): Promise<BulkExportJob> {
  const format = input.format === 'zip' || input.format === 'obsidian' ? input.format : null;
  const articleIds = normalizeArticleIds(input.articleIds);
  if (!format || !articleIds) {
    throw new Error('BULK_EXPORT_INVALID_INPUT: 批量导出参数无效');
  }

  await ensureBulkExportSchema();
  const expiresAt = new Date(Date.now() + BULK_EXPORT_TTL_HOURS * 60 * 60 * 1000);
  const [job] = await db.insert(bulkExportJobs).values({
    userId,
    format,
    status: 'queued',
    requestedCount: articleIds.length,
    articleIds,
    includeAi: input.includeAi,
    organizeByCategory: input.organizeByCategory,
    filePath: path.join(BULK_EXPORT_ROOT, `${userId}-${randomUUID()}.zip`),
    fileName: `storing-export-${new Date().toISOString().slice(0, 19).replaceAll(/[:T]/g, '')}.zip`,
    failureDetail: [],
    expiresAt,
  }).returning();

  void runBulkExportJob(job.id).catch(async (error) => {
    console.error('Bulk export job failed:', error instanceof Error ? error.message : error);
    await db.update(bulkExportJobs).set({
      status: 'failed',
      errorMessage: error instanceof Error ? error.message : '批量导出失败',
      finishedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(bulkExportJobs.id, job.id));
  });
  return normalizeJob(job);
}

export async function getBulkExportJob(userId: number, jobId: number): Promise<BulkExportJob | null> {
  const [row] = await db
    .select()
    .from(bulkExportJobs)
    .where(and(eq(bulkExportJobs.id, jobId), eq(bulkExportJobs.userId, userId)))
    .limit(1);
  return row ? normalizeJob(row) : null;
}

export async function runBulkExportJob(jobId: number): Promise<void> {
  const [job] = await db
    .select()
    .from(bulkExportJobs)
    .where(eq(bulkExportJobs.id, jobId))
    .limit(1);
  if (!job || job.status === 'running' || job.status === 'succeeded') return;

  await db.update(bulkExportJobs).set({
    status: 'running',
    updatedAt: new Date(),
  }).where(eq(bulkExportJobs.id, jobId));

  const failures: BulkExportFailureDetail = [];
  const exported: BulkExportArticleInput[] = [];
  try {
    const requestedIds = Array.isArray(job.articleIds)
      ? job.articleIds.map((value) => Number(value)).filter((value) => Number.isSafeInteger(value) && value > 0)
      : [];
    const rows = await db
      .select({
        articleId: articles.id,
        title: articles.title,
        author: articles.author,
        source: articles.source,
        originalUrl: articles.originalUrl,
        publishedAt: articles.publishTime,
        savedAt: articles.createdAt,
        categoryName: categories.name,
        aiSummary: articleMetadata.aiSummary,
        aiTags: articleMetadata.aiTags,
        userContentMd: articleMetadata.contentMd,
        sharedContentMd: articles.contentMarkdown,
      })
      .from(articles)
      .innerJoin(articleMetadata, and(
        eq(articles.id, articleMetadata.articleId),
        eq(articleMetadata.userId, job.userId),
      ))
      .leftJoin(categories, and(
        eq(categories.id, articleMetadata.categoryId),
        eq(categories.userId, job.userId),
      ))
      .where(and(
        eq(articleMetadata.userId, job.userId),
        eq(articleMetadata.isDeleted, false),
        inArray(articles.id, requestedIds),
      ));

    const foundIds = new Set(rows.map((row) => row.articleId));
    for (const articleId of requestedIds) {
      if (!foundIds.has(articleId)) {
        failures.push({ articleId, code: 'NOT_FOUND', message: '文章不存在或无权访问' });
      }
    }
    for (const row of rows) {
      const contentMd = row.userContentMd || row.sharedContentMd;
      if (!contentMd) {
        failures.push({ articleId: row.articleId, code: 'BODY_NOT_READY', message: '正文尚未准备完成' });
        continue;
      }
      const categoryName = job.organizeByCategory ? row.categoryName : null;
      exported.push({
        articleId: row.articleId,
        title: row.title || '未命名文章',
        author: row.author,
        source: row.source,
        originalUrl: row.originalUrl,
        publishedAt: row.publishedAt,
        savedAt: row.savedAt,
        categoryName,
        aiSummary: job.includeAi ? row.aiSummary : null,
        aiTags: job.includeAi ? row.aiTags : [],
        contentMd,
      });
    }

    await mkdir(path.dirname(job.filePath), { recursive: true });
    const output = createWriteStream(job.filePath);
    const archive = new Archiver({ zlib: { level: 9 } });
    archive.pipe(output);
    const usedPaths = new Set<string>();
    for (const article of exported) {
      const entryPath = buildExportEntryPath(article, usedPaths);
      archive.append(buildObsidianMarkdown(article), { name: entryPath });
    }
    archive.append(buildExportManifest(job.format as BulkExportFormat, exported, failures), { name: 'manifest.json' });
    await archive.finalize();
    await finished(output);

    const fileInfo = await stat(job.filePath);
    await db.update(bulkExportJobs).set({
      status: 'succeeded',
      succeededCount: exported.length,
      failedCount: failures.length,
      failureDetail: failures,
      fileSize: fileInfo.size,
      finishedAt: new Date(),
      updatedAt: new Date(),
      errorMessage: null,
    }).where(eq(bulkExportJobs.id, jobId));
  } catch (error) {
    await rm(job.filePath, { force: true });
    await db.update(bulkExportJobs).set({
      status: 'failed',
      failedCount: failures.length || job.requestedCount - exported.length,
      failureDetail: failures,
      errorMessage: error instanceof Error ? error.message : '批量导出失败',
      finishedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(bulkExportJobs.id, jobId));
    throw error;
  }
}

export async function openBulkExportDownload(
  userId: number,
  jobId: number,
): Promise<{ stream: Readable; filename: string; size: number } | null> {
  const [job] = await db
    .select()
    .from(bulkExportJobs)
    .where(and(
      eq(bulkExportJobs.id, jobId),
      eq(bulkExportJobs.userId, userId),
      eq(bulkExportJobs.status, 'succeeded'),
      isNotNull(bulkExportJobs.fileSize),
    ))
    .limit(1);
  if (!job?.fileSize) return null;
  try {
    await stat(job.filePath);
  } catch {
    return null;
  }
  return {
    stream: createReadStream(job.filePath),
    filename: job.fileName,
    size: job.fileSize,
  };
}

export function buildBulkExportHeaders(download: { filename: string; size: number }): Record<string, string> {
  return {
    'Content-Type': 'application/zip',
    'Content-Length': String(download.size),
    'Content-Disposition': `attachment; filename="${download.filename}"`,
  };
}

export async function cleanupExpiredBulkExportJobs(): Promise<void> {
  const expired = await db.delete(bulkExportJobs)
    .where(lt(bulkExportJobs.expiresAt, new Date()))
    .returning({ filePath: bulkExportJobs.filePath });
  await Promise.all(expired.map((job) => unlink(job.filePath).catch(() => undefined)));
}
