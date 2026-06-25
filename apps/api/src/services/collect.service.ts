import { execFile } from 'child_process';
import { promisify } from 'util';
import { mkdtemp, readFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { JSDOM } from 'jsdom';
import { desc, eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { articleMetadata, articles, collectJobs } from '../db/schema.js';
import { generateSummaryAndTags } from './ai.service.js';
import { getArticleContent, processCoverImage, uploadImage } from './reader.service.js';
import { enqueueArticleForWiki, processWikiJobs } from './wiki.service.js';

const execFileAsync = promisify(execFile);

const COLLECT_TABLE_SQL = `
  CREATE TABLE IF NOT EXISTS collect_jobs (
    id SERIAL PRIMARY KEY,
    url TEXT NOT NULL,
    normalized_url TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    stage TEXT NOT NULL DEFAULT 'queued',
    method TEXT NOT NULL DEFAULT 'singlefile',
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
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withProtocol);
  url.hash = '';
  return url.toString();
}

function isSafeCollectUrl(url: URL) {
  if (!['http:', 'https:'].includes(url.protocol)) return false;
  const host = url.hostname.toLowerCase();
  if (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '0.0.0.0' ||
    host === '::1' ||
    host.endsWith('.local')
  ) {
    return false;
  }
  return true;
}

function shellQuote(value: string) {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function getSingleFileCommand() {
  return process.env.SINGLEFILE_COMMAND || 'single-file';
}

function getSingleFileArgs(url: string) {
  return [
    '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    '--browser-arg=--disable-blink-features=AutomationControlled',
  ];
}

async function runSingleFileWithDocker(url: string, timeoutMs: number, maxBuffer: number) {
  const image = process.env.SINGLEFILE_DOCKER_IMAGE || 'capsulecode/singlefile';
  const args = [
    'run',
    '--rm',
    image,
    ...getSingleFileArgs(url),
    url,
  ];

  const { stdout } = await execFileAsync('docker', args, { timeout: timeoutMs, maxBuffer });
  return stdout;
}

async function runSingleFileWithNpx(url: string, timeoutMs: number) {
  const dir = await mkdtemp(join(tmpdir(), 'storing-singlefile-'));
  const outputPath = join(dir, 'page.html');

  try {
    await execFileAsync(
      'npx',
      [
        '-y',
        'single-file-cli',
        url,
        outputPath,
        ...getSingleFileArgs(url),
        '--browser-load-max-time=60000',
        '--browser-capture-max-time=60000',
      ],
      { timeout: Math.max(timeoutMs, 180000), maxBuffer: 4 * 1024 * 1024 }
    );
    return await readFile(outputPath, 'utf8');
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function runSingleFile(url: string) {
  const command = getSingleFileCommand();
  const timeoutMs = Number(process.env.SINGLEFILE_TIMEOUT_MS || 180000);
  const maxBuffer = Number(process.env.SINGLEFILE_MAX_BUFFER || 80 * 1024 * 1024);

  try {
    if (command.includes(' ')) {
      const { stdout } = await execFileAsync('/bin/sh', ['-lc', `${command} ${shellQuote(url)}`], {
        timeout: timeoutMs,
        maxBuffer,
      });
      return stdout;
    }

    const { stdout } = await execFileAsync(command, [url], { timeout: timeoutMs, maxBuffer });
    return stdout;
  } catch (e) {
    const error = e as NodeJS.ErrnoException;
    if (command === 'single-file' && error.code === 'ENOENT') {
      try {
        return await runSingleFileWithDocker(url, timeoutMs, maxBuffer);
      } catch {
        return runSingleFileWithNpx(url, timeoutMs);
      }
    }
    throw e;
  }
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

function absolutizeUrl(value: string, baseUrl: string) {
  if (!value || value.startsWith('data:') || value.startsWith('blob:') || value.startsWith('mailto:') || value.startsWith('tel:')) {
    return value;
  }
  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return value;
  }
}

function extractMetaImage(doc: Document, baseUrl: string) {
  const selectors = [
    'meta[property="og:image"]',
    'meta[property="og:image:secure_url"]',
    'meta[name="twitter:image"]',
    'meta[property="twitter:image"]',
  ];

  for (const selector of selectors) {
    const value = doc.querySelector(selector)?.getAttribute('content')?.trim();
    if (value) return absolutizeUrl(value, baseUrl);
  }

  const firstArticleImage =
    doc.querySelector<HTMLImageElement>('article img[src], article img[data-src]') ||
    doc.querySelector<HTMLImageElement>('main img[src], main img[data-src]') ||
    doc.querySelector<HTMLImageElement>('img[src], img[data-src]');

  if (!firstArticleImage) return null;

  for (const attr of ['data-src', 'data-original', 'data-lazy-src', 'data-url', 'src']) {
    const value = firstArticleImage.getAttribute(attr)?.trim();
    if (value) return absolutizeUrl(value, baseUrl);
  }

  return null;
}

function getImageCandidate(image: HTMLImageElement, baseUrl: string) {
  for (const attr of ['data-src', 'data-original', 'data-lazy-src', 'data-url', 'src']) {
    const value = image.getAttribute(attr)?.trim();
    if (!value) continue;
    if (value.startsWith('data:image/')) return value;
    if (value.startsWith('data:') || value.startsWith('blob:')) continue;
    return absolutizeUrl(value, baseUrl);
  }
  return null;
}

async function uploadImagesInCapturedDocument(html: string, baseUrl: string) {
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  const images = Array.from(doc.querySelectorAll<HTMLImageElement>('img'));

  await Promise.all(
    images.map(async (image) => {
      const originalUrl = getImageCandidate(image, baseUrl);
      if (!originalUrl) return;

      const uploadedUrl = await uploadImage(originalUrl);
      if (!uploadedUrl) return;

      image.setAttribute('src', uploadedUrl);
      image.setAttribute('referrerpolicy', 'no-referrer');
      image.removeAttribute('srcset');
      image.removeAttribute('data-src');
      image.removeAttribute('data-original');
      image.removeAttribute('data-lazy-src');
      image.removeAttribute('data-url');
    })
  );

  return dom.serialize();
}

function prepareCapturedDocument(rawHtml: string, baseUrl: string) {
  const dom = new JSDOM(rawHtml);
  const doc = dom.window.document;
  const title = extractTitle(doc, baseUrl);
  const source = extractSource(baseUrl, doc);
  const coverImage = extractMetaImage(doc, baseUrl);

  doc.querySelectorAll('script,noscript').forEach((node) => node.remove());
  doc.querySelectorAll('a[href]').forEach((link) => {
    const href = link.getAttribute('href');
    if (!href) return;
    link.setAttribute('href', absolutizeUrl(href, baseUrl));
    link.setAttribute('target', '_blank');
    link.setAttribute('rel', 'noopener noreferrer');
  });
  doc.querySelectorAll('img[src],img[data-src]').forEach((image) => {
    for (const attr of ['src', 'data-src', 'data-original', 'data-lazy-src', 'data-url']) {
      const value = image.getAttribute(attr);
      if (value) image.setAttribute(attr, absolutizeUrl(value, baseUrl));
    }
  });

  doc.documentElement.setAttribute('data-storing-capture', 'singlefile');
  doc.documentElement.setAttribute('data-capture-source', baseUrl);
  doc.body?.setAttribute('data-storing-capture-body', 'true');
  doc.body?.classList.add('manual-capture-page');

  return { title, source, coverImage, html: dom.serialize() };
}

function extractTextFromHtml(html: string) {
  const dom = new JSDOM(html);
  const text = dom.window.document.body?.textContent?.replace(/\s+/g, ' ').trim() || '';
  return text.slice(0, 60000);
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
  if (input.contentHtml) metadataValues.contentHtml = input.contentHtml;
  if (input.contentMarkdown) metadataValues.contentMd = input.contentMarkdown;
  if (input.coverImage) metadataValues.coverImage = input.coverImage;

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

  await updateCollectJob(jobId, { stage: 'reader_fetch', articleId, title });
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
  await updateCollectJob(jobId, { stage: 'capturing' });
  const rawHtml = await runSingleFile(normalizedUrl);
  if (!rawHtml.trim()) throw new Error('SingleFile 没有返回 HTML 内容');

  await updateCollectJob(jobId, { stage: 'uploading_images' });
  const prepared = prepareCapturedDocument(rawHtml, normalizedUrl);
  const [uploadedHtml, uploadedCoverImage] = await Promise.all([
    uploadImagesInCapturedDocument(prepared.html, normalizedUrl),
    prepared.coverImage ? uploadImage(prepared.coverImage) : Promise.resolve(null),
  ]);
  const contentMarkdown = extractTextFromHtml(uploadedHtml);

  await updateCollectJob(jobId, { stage: 'saving', title: prepared.title });
  const articleId = await upsertArticleFromCapture({
    normalizedUrl,
    title: prepared.title,
    source: prepared.source,
    contentHtml: uploadedHtml,
    contentMarkdown,
    coverImage: uploadedCoverImage || prepared.coverImage,
    method: 'singlefile',
  });

  await updateCollectJob(jobId, {
    status: 'completed',
    stage: 'completed',
    articleId,
    title: prepared.title,
    finishedAt: new Date(),
  });
  await finishArticleSideEffects(articleId);
}

export async function initCollectSchema() {
  await db.execute(sql.raw(COLLECT_TABLE_SQL));
}

export async function createCollectJob(rawUrl: string) {
  const normalizedUrl = normalizeCollectUrl(rawUrl);
  const parsed = new URL(normalizedUrl);
  if (!isSafeCollectUrl(parsed)) {
    throw new Error('仅支持采集公开的 http/https 网页链接');
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

export async function getCollectJob(jobId: number) {
  const [job] = await db.select().from(collectJobs).where(eq(collectJobs.id, jobId)).limit(1);
  return job ?? null;
}

export async function listCollectJobs(limit = 12) {
  return db
    .select()
    .from(collectJobs)
    .orderBy(desc(collectJobs.createdAt))
    .limit(limit);
}
