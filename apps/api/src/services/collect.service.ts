import { isIP } from 'net';
import { JSDOM } from 'jsdom';
import { desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { articleMetadata, articles, collectJobs } from '../db/schema.js';
import { generateSummaryAndTags } from './ai.service.js';
import { ensureArticleMetadataContentHtmlMobileColumn, getArticleContent, processCoverImage, uploadImage } from './reader.service.js';
import {
  extractTextFromHtml,
  getInitialSingleFileStrategy,
  prepareCapturedDocument,
  runSingleFile,
  uploadImagesInCapturedDocument,
} from './singlefile.service.js';
import { enqueueArticleForWiki, processWikiJobs } from './wiki.service.js';

const COLLECT_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS collect_jobs (
    id SERIAL PRIMARY KEY,
    url TEXT NOT NULL,
    normalized_url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    stage TEXT NOT NULL DEFAULT 'queued',
    method TEXT NOT NULL DEFAULT 'singlefile',
    capture_strategy TEXT,
    article_id INTEGER REFERENCES articles(id) ON DELETE SET NULL,
    title TEXT,
    error TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    started_at TIMESTAMP,
    finished_at TIMESTAMP
  )
`;

type CollectJobStatus = 'pending' | 'running' | 'completed' | 'failed';
type CollectMethod = 'reader' | 'singlefile';

function isWechatUrl(url: string) {
  try {
    return new URL(url).hostname.includes('mp.weixin.qq.com');
  } catch {
    return false;
  }
}

function normalizeCollectUrl(rawUrl: string) {
  const trimmed = rawUrl.trim();
  if (!trimmed || /\s/.test(trimmed)) {
    throw new Error('请输入有效的网页链接');
  }
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let url: URL;
  try {
    url = new URL(withProtocol);
  } catch {
    throw new Error('请输入有效的网页链接');
  }
  url.hash = '';
  return url.toString();
}

function isPrivateIpv4(host: string) {
  const parts = host.split('.').map((part) => Number(part));
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [first, second] = parts;
  return (
    first === 10 ||
    first === 127 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 169 && second === 254) ||
    first === 0
  );
}

function isPrivateIpv6(host: string) {
  const normalized = host.toLowerCase();
  return normalized === '::1' || normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe80:');
}

function isSafeCollectUrl(url: URL) {
  if (!['http:', 'https:'].includes(url.protocol)) return false;
  const host = url.hostname.toLowerCase();
  if (
    !host ||
    host === 'localhost' ||
    host.endsWith('.local')
  ) {
    return false;
  }

  const ipVersion = isIP(host);
  if (ipVersion === 4) return !isPrivateIpv4(host);
  if (ipVersion === 6) return !isPrivateIpv6(host);

  if (!host.includes('.') || host.startsWith('.') || host.endsWith('.')) return false;
  return true;
}

function extractTitle(doc: Document, fallbackUrl: string) {
  const title =
    doc.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
    doc.querySelector('title')?.textContent ||
    doc.querySelector('h1')?.textContent ||
    fallbackUrl;
  return title.replace(/\s+/g, ' ').trim().slice(0, 180);
}

function extractSource(url: string, doc?: Document) {
  const siteName = doc?.querySelector('meta[property="og:site_name"]')?.getAttribute('content')?.trim();
  if (siteName) return siteName.slice(0, 80);
  return new URL(url).hostname.replace(/^www\./, '').slice(0, 80);
}

async function fetchWechatPageMeta(url: string) {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return null;

    const html = await res.text();
    const dom = new JSDOM(html);
    const doc = dom.window.document;
    const title = extractTitle(doc, url);
    const source =
      doc.querySelector('#js_name')?.textContent?.replace(/\s+/g, ' ').trim() ||
      doc.querySelector('meta[property="og:article:author"]')?.getAttribute('content')?.trim() ||
      doc.querySelector('meta[name="author"]')?.getAttribute('content')?.trim() ||
      '微信公众号';

    return {
      title: title === url ? null : title,
      source: source.slice(0, 80),
    };
  } catch {
    return null;
  }
}

async function getNextArticleId() {
  const [row] = await db.select({ nextId: sql<number>`COALESCE(MAX(${articles.id}), 0) + 1` }).from(articles);
  return Number(row?.nextId || 1);
}

async function upsertArticleFromCapture(input: {
  normalizedUrl: string;
  title: string;
  source: string;
  contentHtml?: string | null;
  contentHtmlMobile?: string | null;
  contentMarkdown?: string | null;
  coverImage?: string | null;
  method: CollectMethod;
}) {
  const [existing] = await db
    .select({ id: articles.id })
    .from(articles)
    .where(eq(articles.originalUrl, input.normalizedUrl))
    .limit(1);

  const now = new Date();
  let articleId = existing?.id;

  if (articleId) {
    await db
      .update(articles)
      .set({
        title: input.title,
        source: input.source,
        coverImage: input.coverImage ?? undefined,
        contentHtml: input.contentHtml ?? undefined,
        contentMarkdown: input.contentMarkdown ?? undefined,
        updatedAt: now,
      })
      .where(eq(articles.id, articleId));
  } else {
    articleId = await getNextArticleId();
    await db.insert(articles).values({
      id: articleId,
      title: input.title,
      source: input.source,
      originalUrl: input.normalizedUrl,
      contentHtml: input.contentHtml ?? null,
      contentMarkdown: input.contentMarkdown ?? null,
      coverImage: input.coverImage ?? null,
      content: { collectMethod: input.method, originalUrl: input.normalizedUrl },
      readStatus: 'unread',
      createdAt: now,
      updatedAt: now,
    });
  }

  const [meta] = await db.select({ id: articleMetadata.id }).from(articleMetadata).where(eq(articleMetadata.articleId, articleId));
  const metadataValues: Partial<typeof articleMetadata.$inferInsert> = {
    isArchived: true,
    archivedAt: now,
    updatedAt: now,
  };
  if (input.contentHtml !== undefined) metadataValues.contentHtml = input.contentHtml;
  if (input.contentHtmlMobile !== undefined) metadataValues.contentHtmlMobile = input.contentHtmlMobile;
  if (input.contentMarkdown !== undefined) metadataValues.contentMd = input.contentMarkdown;
  if (input.coverImage !== undefined) metadataValues.coverImage = input.coverImage;

  if (meta) {
    await db.update(articleMetadata).set(metadataValues).where(eq(articleMetadata.articleId, articleId));
  } else {
    await db.insert(articleMetadata).values({ articleId, isFavorited: false, ...metadataValues });
  }

  return articleId;
}

async function updateCollectJob(id: number, values: Partial<typeof collectJobs.$inferInsert>) {
  await db.update(collectJobs).set({ ...values, updatedAt: new Date() }).where(eq(collectJobs.id, id));
}

async function finishArticleSideEffects(articleId: number) {
  generateSummaryAndTags(articleId).catch((e) => console.error('Collect AI summary/tags failed:', e.message));
  processCoverImage(articleId).catch((e) => console.error('Collect cover image failed:', e.message));
  enqueueArticleForWiki(articleId).then(() => processWikiJobs(3)).catch((e) => console.error('Collect wiki enqueue failed:', e.message));
}

async function processWechatJob(jobId: number, normalizedUrl: string) {
  const title = normalizedUrl;
  const source = '微信公众号';
  const articleId = await upsertArticleFromCapture({
    normalizedUrl,
    title,
    source,
    method: 'reader',
  });

  await updateCollectJob(jobId, { stage: 'reader_fetch', captureStrategy: 'wechat_reader', articleId, title });
  await Promise.allSettled([getArticleContent(articleId, 'html'), getArticleContent(articleId, 'markdown')]);
  const pageMeta = await fetchWechatPageMeta(normalizedUrl);
  if (pageMeta?.title || pageMeta?.source) {
    const finalTitle = pageMeta.title || title;
    const finalSource = pageMeta.source || source;
    await db
      .update(articles)
      .set({ title: finalTitle, source: finalSource, updatedAt: new Date() })
      .where(eq(articles.id, articleId));
    await updateCollectJob(jobId, { title: finalTitle });
  }
  await updateCollectJob(jobId, {
    status: 'completed',
    stage: 'completed',
    articleId,
    finishedAt: new Date(),
  });
  await finishArticleSideEffects(articleId);
}

async function processSingleFileJob(jobId: number, normalizedUrl: string) {
  await updateCollectJob(jobId, { stage: 'capturing', captureStrategy: getInitialSingleFileStrategy() });
  const { html: desktopRawHtml, strategy } = await runSingleFile(normalizedUrl, 'desktop');
  if (!desktopRawHtml.trim()) throw new Error('SingleFile 没有返回 HTML 内容');

  await updateCollectJob(jobId, { stage: 'uploading_images', captureStrategy: strategy });
  const desktopPrepared = prepareCapturedDocument(desktopRawHtml, normalizedUrl);
  const [desktopHtml, uploadedCoverImage] = await Promise.all([
    uploadImagesInCapturedDocument(desktopPrepared.html, normalizedUrl, uploadImage),
    desktopPrepared.coverImage ? uploadImage(desktopPrepared.coverImage) : Promise.resolve(null),
  ]);
  const contentMarkdown = extractTextFromHtml(desktopHtml);

  let mobileHtml: string | null = null;
  try {
    await updateCollectJob(jobId, { stage: 'capturing_mobile', captureStrategy: strategy });
    const { html: mobileRawHtml } = await runSingleFile(normalizedUrl, 'mobile');
    if (mobileRawHtml.trim()) {
      await updateCollectJob(jobId, { stage: 'uploading_mobile_images', captureStrategy: strategy });
      const mobilePrepared = prepareCapturedDocument(mobileRawHtml, normalizedUrl);
      mobileHtml = await uploadImagesInCapturedDocument(mobilePrepared.html, normalizedUrl, uploadImage);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`SingleFile mobile capture failed for ${normalizedUrl}: ${message}`);
  }

  await updateCollectJob(jobId, { stage: 'saving', title: desktopPrepared.title });
  const articleId = await upsertArticleFromCapture({
    normalizedUrl,
    title: desktopPrepared.title,
    source: desktopPrepared.source,
    contentHtml: desktopHtml,
    contentHtmlMobile: mobileHtml,
    contentMarkdown,
    coverImage: uploadedCoverImage || desktopPrepared.coverImage,
    method: 'singlefile',
  });

  await updateCollectJob(jobId, {
    status: 'completed',
    stage: 'completed',
    articleId,
    title: desktopPrepared.title,
    finishedAt: new Date(),
  });
  await finishArticleSideEffects(articleId);
}

export async function initCollectSchema() {
  await db.execute(sql.raw(COLLECT_TABLE_SQL));
  await db.execute(sql.raw(`ALTER TABLE collect_jobs ADD COLUMN IF NOT EXISTS capture_strategy TEXT`));
  await ensureArticleMetadataContentHtmlMobileColumn();
  const defaultSingleFileStrategy = getInitialSingleFileStrategy();
  await db.execute(sql.raw(`
    UPDATE collect_jobs
    SET capture_strategy = CASE
      WHEN method = 'reader' THEN 'wechat_reader'
      ELSE '${defaultSingleFileStrategy}'
    END
    WHERE capture_strategy IS NULL
  `));
}

export async function createCollectJob(rawUrl: string) {
  const normalizedUrl = normalizeCollectUrl(rawUrl);
  const parsed = new URL(normalizedUrl);
  if (!isSafeCollectUrl(parsed)) {
    throw new Error('请输入有效的公开网页链接');
  }

  const method: CollectMethod = isWechatUrl(normalizedUrl) ? 'reader' : 'singlefile';
  const [job] = await db
    .insert(collectJobs)
    .values({
      url: rawUrl.trim(),
      normalizedUrl,
      status: 'pending',
      stage: 'queued',
      method,
      captureStrategy: method === 'reader' ? 'wechat_reader' : null,
    })
    .returning();

  processCollectJob(job.id).catch((e) => console.error(`Collect job ${job.id} failed:`, e.message));
  return job;
}

export async function processCollectJob(jobId: number) {
  const [job] = await db.select().from(collectJobs).where(eq(collectJobs.id, jobId)).limit(1);
  if (!job || job.status === 'running' || job.status === 'completed') return job;

  await updateCollectJob(jobId, { status: 'running', stage: 'starting', startedAt: new Date(), error: null });

  try {
    if (job.method === 'reader') {
      await processWechatJob(jobId, job.normalizedUrl);
    } else {
      await processSingleFileJob(jobId, job.normalizedUrl);
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : '采集失败';
    await updateCollectJob(jobId, {
      status: 'failed',
      stage: 'failed',
      error: message,
      finishedAt: new Date(),
    });
  }

  const [updated] = await db.select().from(collectJobs).where(eq(collectJobs.id, jobId)).limit(1);
  return updated;
}

function normalizeCollectJobStrategy<T extends typeof collectJobs.$inferSelect>(job: T) {
  if (job.captureStrategy) return job;
  return {
    ...job,
    captureStrategy: job.method === 'reader' ? 'wechat_reader' : getInitialSingleFileStrategy(),
  };
}

export async function getCollectJob(jobId: number) {
  const [job] = await db.select().from(collectJobs).where(eq(collectJobs.id, jobId)).limit(1);
  return job ? normalizeCollectJobStrategy(job) : null;
}

export async function listCollectJobs(limit = 12, offset = 0) {
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const safeOffset = Math.max(offset, 0);
  const jobs = await db
    .select()
    .from(collectJobs)
    .orderBy(desc(collectJobs.createdAt))
    .limit(safeLimit)
    .offset(safeOffset);
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(collectJobs);

  return {
    jobs: jobs.map(normalizeCollectJobStrategy),
    total,
    hasMore: safeOffset + jobs.length < total,
  };
}

export async function deleteCollectJob(jobId: number) {
  const job = await getCollectJob(jobId);
  if (!job) return { deleted: false, reason: 'not_found' as const };
  if (job.status === 'running') return { deleted: false, reason: 'running' as const };

  await db.delete(collectJobs).where(eq(collectJobs.id, jobId));
  return { deleted: true, reason: null };
}

export async function clearFinishedCollectJobs() {
  const deleted = await db
    .delete(collectJobs)
    .where(inArray(collectJobs.status, ['completed', 'failed']))
    .returning({ id: collectJobs.id });

  return { deletedCount: deleted.length };
}
