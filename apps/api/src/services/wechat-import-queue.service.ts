import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { mkdir, readFile, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as NodeWebReadableStream } from 'node:stream/web';
import { and, eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { wechatImportJobs } from '../db/schema.js';
import {
  WECHAT_IMPORT_MAX_FILE_COUNT,
  WECHAT_IMPORT_MAX_SINGLE_FILE_BYTES,
  WECHAT_IMPORT_MAX_TOTAL_BYTES,
  importWeChatShare,
  WeChatImportError,
  type WeChatSharedFile,
} from './wechat-import.service.js';

export interface IncomingWeChatImportFile {
  file: File;
  displayName: string;
  mime: string;
}

export interface WeChatImportJobPayload {
  source: 'android' | 'macos';
  files: Array<{
    displayName: string;
    filename: string;
    mime: string;
    size: number;
  }>;
}

export type WeChatImportJobRecord = typeof wechatImportJobs.$inferSelect;

const STORAGE_ROOT = path.resolve(
  process.env.WECHAT_IMPORT_STORAGE_DIR || path.join(process.cwd(), 'data', 'wechat-imports'),
);
const MAX_CONCURRENT_IMPORTS = Math.min(
  Math.max(Number(process.env.WECHAT_IMPORT_CONCURRENCY || 2), 1),
  4,
);
let activeJobCount = 0;
let isPumping = false;

export async function ensureWeChatImportQueueSchema(): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS wechat_import_jobs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      request_source TEXT NOT NULL DEFAULT 'android',
      status TEXT NOT NULL DEFAULT 'pending',
      stage TEXT NOT NULL DEFAULT 'queued',
      storage_dir TEXT NOT NULL,
      payload JSONB NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      article_id INTEGER REFERENCES articles(id),
      title TEXT,
      message_count INTEGER,
      media_count INTEGER,
      uploaded_media_count INTEGER,
      error TEXT,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      started_at TIMESTAMP,
      finished_at TIMESTAMP
    )
  `);
  await db.execute(
    'CREATE INDEX IF NOT EXISTS wechat_import_jobs_user_created_idx ON wechat_import_jobs (user_id, created_at)',
  );
  await db.execute(
    'CREATE INDEX IF NOT EXISTS wechat_import_jobs_status_idx ON wechat_import_jobs (status, id)',
  );
}

function safeImportFilename(rawName: string, index: number): string {
  const base = rawName.split(/[\\/]/).pop()?.trim() || `file-${index + 1}`;
  const cleaned = base
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .replace(/\s+/g, ' ')
    .slice(0, 180);
  return cleaned || `file-${index + 1}`;
}

async function stageIncomingFile(
  storageDir: string,
  incoming: IncomingWeChatImportFile,
  index: number,
): Promise<WeChatImportJobPayload['files'][number]> {
  if (incoming.file.size > WECHAT_IMPORT_MAX_SINGLE_FILE_BYTES) {
    throw new WeChatImportError('单个文件超过 100MB 限制');
  }

  const displayName = safeImportFilename(incoming.displayName, index);
  const filename = `${index + 1}-${displayName}`;
  const destination = path.join(storageDir, filename);
  await pipeline(
    Readable.fromWeb(incoming.file.stream() as unknown as NodeWebReadableStream),
    createWriteStream(destination),
  );
  const saved = await stat(destination);
  if (saved.size !== incoming.file.size) {
    throw new WeChatImportError('导入文件保存不完整，请重试');
  }
  return { displayName, filename, mime: incoming.mime || 'application/octet-stream', size: saved.size };
}

export async function createWeChatImportJob(
  userId: number,
  source: 'android' | 'macos',
  incomingFiles: IncomingWeChatImportFile[],
): Promise<WeChatImportJobRecord> {
  if (incomingFiles.length === 0) throw new WeChatImportError('没有收到可导入的文件');
  if (incomingFiles.length > WECHAT_IMPORT_MAX_FILE_COUNT) {
    throw new WeChatImportError(`单次最多导入 ${WECHAT_IMPORT_MAX_FILE_COUNT} 个文件`);
  }
  const totalBytes = incomingFiles.reduce((sum, file) => sum + file.file.size, 0);
  if (totalBytes > WECHAT_IMPORT_MAX_TOTAL_BYTES) {
    throw new WeChatImportError('导入内容总量超过限制');
  }

  const storageDir = path.join(STORAGE_ROOT, randomUUID());
  await mkdir(storageDir, { recursive: true });
  try {
    const files = [];
    for (const [index, incoming] of incomingFiles.entries()) {
      files.push(await stageIncomingFile(storageDir, incoming, index));
    }

    const [job] = await db
      .insert(wechatImportJobs)
      .values({
        userId,
        requestSource: source,
        status: 'pending',
        stage: 'queued',
        storageDir,
        payload: { source, files } satisfies WeChatImportJobPayload,
      })
      .returning();
    return job;
  } catch (error) {
    await rm(storageDir, { recursive: true, force: true });
    throw error;
  }
}

export function serializeWeChatImportJob(job: WeChatImportJobRecord) {
  return {
    id: job.id,
    status: job.status,
    stage: job.stage,
    articleId: job.articleId,
    title: job.title,
    messageCount: job.messageCount,
    mediaCount: job.mediaCount,
    uploadedMediaCount: job.uploadedMediaCount,
    error: job.error,
    createdAt: job.createdAt?.toISOString() ?? null,
    startedAt: job.startedAt?.toISOString() ?? null,
    finishedAt: job.finishedAt?.toISOString() ?? null,
  };
}

export async function getWeChatImportJob(
  jobId: number,
  userId: number,
): Promise<WeChatImportJobRecord | null> {
  const [job] = await db
    .select()
    .from(wechatImportJobs)
    .where(and(eq(wechatImportJobs.id, jobId), eq(wechatImportJobs.userId, userId)))
    .limit(1);
  return job ?? null;
}

async function claimNextWeChatImportJob(): Promise<WeChatImportJobRecord | null> {
  const candidates = await db
    .select({ id: wechatImportJobs.id, attempts: wechatImportJobs.attempts })
    .from(wechatImportJobs)
    .where(eq(wechatImportJobs.status, 'pending'))
    .orderBy(wechatImportJobs.id)
    .limit(1);
  const candidate = candidates[0];
  if (!candidate) return null;

  const [job] = await db
    .update(wechatImportJobs)
    .set({
      status: 'running',
      stage: 'starting',
      attempts: candidate.attempts + 1,
      error: null,
      startedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(and(eq(wechatImportJobs.id, candidate.id), eq(wechatImportJobs.status, 'pending')))
    .returning();
  return job ?? null;
}

async function cleanupImportStorage(storageDir: string): Promise<void> {
  await rm(storageDir, { recursive: true, force: true }).catch((error) => {
    console.error('WeChat import cleanup failed:', error instanceof Error ? error.message : error);
  });
}

async function processWeChatImportJob(job: WeChatImportJobRecord): Promise<void> {
  const payload = job.payload as WeChatImportJobPayload;
  try {
    await db
      .update(wechatImportJobs)
      .set({ stage: 'reading_payload', updatedAt: new Date() })
      .where(eq(wechatImportJobs.id, job.id));

    const sharedFiles: WeChatSharedFile[] = [];
    for (const file of payload.files) {
      sharedFiles.push({
        filename: file.filename,
        mime: file.mime,
        data: await readFile(path.join(job.storageDir, file.filename)),
      });
    }

    await db
      .update(wechatImportJobs)
      .set({ stage: 'uploading_media', updatedAt: new Date() })
      .where(eq(wechatImportJobs.id, job.id));
    const result = await importWeChatShare(sharedFiles, {
      userId: job.userId,
      chatName: null,
      source: payload.source,
    });

    await db
      .update(wechatImportJobs)
      .set({
        status: 'completed',
        stage: 'completed',
        articleId: result.articleId,
        title: result.title,
        messageCount: result.messageCount,
        mediaCount: result.mediaCount,
        uploadedMediaCount: result.uploadedMediaCount,
        error: null,
        finishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(wechatImportJobs.id, job.id));
  } catch (error) {
    const message = error instanceof Error ? error.message : '微信内容导入失败';
    await db
      .update(wechatImportJobs)
      .set({
        status: 'failed',
        stage: 'failed',
        error: message,
        finishedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(wechatImportJobs.id, job.id));
    console.error(`WeChat import job ${job.id} failed:`, message);
  } finally {
    await cleanupImportStorage(job.storageDir);
  }
}

/** 进程内小并发队列；数据库保存状态，重启后 pending 任务会继续处理。 */
export function scheduleWeChatImportJobs(): void {
  void (async () => {
    if (isPumping) return;
    isPumping = true;
    try {
      while (activeJobCount < MAX_CONCURRENT_IMPORTS) {
        const job = await claimNextWeChatImportJob();
        if (!job) break;
        activeJobCount += 1;
        void processWeChatImportJob(job).finally(() => {
          activeJobCount -= 1;
          scheduleWeChatImportJobs();
        });
      }
    } finally {
      isPumping = false;
    }
  })();
}

export async function resumeWeChatImportJobs(): Promise<void> {
  await db
    .update(wechatImportJobs)
    .set({ status: 'pending', stage: 'queued', startedAt: null, updatedAt: new Date() })
    .where(eq(wechatImportJobs.status, 'running'));
  await db
    .update(wechatImportJobs)
    .set({ stage: 'queued', updatedAt: new Date() })
    .where(eq(wechatImportJobs.status, 'pending'));
  scheduleWeChatImportJobs();
}
