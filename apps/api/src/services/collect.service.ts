import { JSDOM } from 'jsdom';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { articleMetadata, articles, collectJobs } from '../db/schema.js';
import { buildArticleSummaryResult, generateSummaryAndTags } from './ai.service.js';
import { assertSafeOutboundUrl, normalizeOutboundUrl } from './outbound-url-policy.service.js';
import { ensureArticleMetadataContentHtmlMobileColumn, fetchArticleContentFromSources, fetchWechatJson, getArticleContent, processCoverImage, uploadImage } from './reader.service.js';
import {
  type CollectCaptureStrategy,
  type HtmlVariant,
  extractTextFromHtml,
  getInitialSingleFileStrategy,
  getSingleFileCandidateStrategies,
  prepareCapturedDocument,
  runSingleFileWithStrategy,
  uploadImagesInCapturedDocument,
  validateCapturedHtml,
} from './singlefile.service.js';

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

type CreateCollectJobOptions = {
  userId?: number | null;
  clientId?: number | null;
  requestSource?: 'web' | 'mcp' | 'api' | 'system';
  saveToInbox?: boolean;
};

type CollectJobAccessFilter = {
  userId?: number;
  clientId?: number;
  requestSource?: 'web' | 'mcp' | 'api' | 'system';
};

// Browser captures can launch Chromium, image processing, and AI work.
// Keep them serialized by default so one user cannot make the API unavailable for everyone.
const WEB_COLLECT_CONCURRENCY = Math.max(1, Number(process.env.WEB_COLLECT_CONCURRENCY || 1));
const MCP_COLLECT_CONCURRENCY = Math.max(1, Number(process.env.MCP_COLLECT_CONCURRENCY || 3));
const MAX_ACTIVE_WEB_COLLECT_JOBS_PER_USER = Math.max(1, Number(process.env.MAX_ACTIVE_WEB_COLLECT_JOBS_PER_USER || 10));
let activeWebCollectWorkers = 0;
let activeMcpCollectWorkers = 0;

function isWechatUrl(url: string) {
  try {
    return new URL(url).hostname.includes('mp.weixin.qq.com');
  } catch {
    return false;
  }
}

function normalizeCollectUrl(rawUrl: string) {
  return normalizeOutboundUrl(rawUrl).toString();
}
function extractTitle(doc: Document, fallbackUrl: string) {
  const values = [
    doc.querySelector('meta[property="og:title"]')?.getAttribute('content'),
    doc.querySelector('meta[name="og:title"]')?.getAttribute('content'),
    doc.querySelector('meta[name="twitter:title"]')?.getAttribute('content'),
    doc.querySelector('meta[property="twitter:title"]')?.getAttribute('content'),
    doc.querySelector('meta[itemprop="headline"]')?.getAttribute('content'),
    doc.querySelector('meta[itemprop="name"]')?.getAttribute('content'),
    doc.querySelector('meta[name="title"]')?.getAttribute('content'),
    doc.querySelector('title')?.textContent,
    doc.querySelector('article h1')?.textContent,
    doc.querySelector('main h1')?.textContent,
    doc.querySelector('h1')?.textContent,
    doc.querySelector('article h2')?.textContent,
    doc.querySelector('main h2')?.textContent,
    doc.querySelector('h2')?.textContent,
  ];

  for (const value of values) {
    const title = value?.replace(/\s+/g, ' ').trim();
    if (title) return title.slice(0, 180);
  }
  return fallbackUrl;
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
}, options: { persistMetadata?: boolean; userId?: number | null; clientId?: number | null; sourceType?: string; markArchived?: boolean } = {}) {
  const persistMetadata = options.persistMetadata ?? true;
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

  if (!persistMetadata) return articleId;

  if (!options.userId) throw new Error('保存文章到收件箱需要用户归属');

  const [meta] = await db
    .select({ id: articleMetadata.id })
    .from(articleMetadata)
    .where(and(eq(articleMetadata.articleId, articleId), eq(articleMetadata.userId, options.userId)));
  const markArchived = options.markArchived ?? true;
  const metadataValues: Partial<typeof articleMetadata.$inferInsert> = {
    isArchived: markArchived,
    archivedAt: markArchived ? now : null,
    updatedAt: now,
  };
  if (input.contentHtml !== undefined) metadataValues.contentHtml = input.contentHtml;
  if (input.contentHtmlMobile !== undefined) metadataValues.contentHtmlMobile = input.contentHtmlMobile;
  if (input.contentMarkdown !== undefined) metadataValues.contentMd = input.contentMarkdown;
  if (input.coverImage !== undefined) metadataValues.coverImage = input.coverImage;

  if (meta) {
    await db.update(articleMetadata).set(metadataValues).where(and(eq(articleMetadata.articleId, articleId), eq(articleMetadata.userId, options.userId)));
  } else {
    await db.insert(articleMetadata).values({
      articleId,
      userId: options.userId,
      clientId: options.clientId ?? null,
      sourceType: options.sourceType ?? 'web',
      isFavorited: false,
      ...metadataValues,
    });
  }

  return articleId;
}

async function updateCollectJob(id: number, values: Partial<typeof collectJobs.$inferInsert>) {
  await db.update(collectJobs).set({ ...values, updatedAt: new Date() }).where(eq(collectJobs.id, id));
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string) {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) return promise;
  return Promise.race<T>([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} 超时（${timeoutMs}ms）`)), timeoutMs);
    }),
  ]);
}

async function finishArticleSideEffects(jobId: number, articleId: number, options: { saveToInbox: boolean; userId?: number | null }) {
  if (options.saveToInbox) {
    if (!options.userId) throw new Error('保存文章到收件箱需要用户归属');
    generateSummaryAndTags(articleId, options.userId).catch((e) => console.error('Collect AI summary/tags failed:', e.message));
    processCoverImage(articleId, options.userId).catch((e) => console.error('Collect cover image failed:', e.message));
    return;
  }

  const summaryTimeoutMs = Number(process.env.SUMMARY_ONLY_TIMEOUT_MS || 120000);
  const result = await withTimeout(buildArticleSummaryResult(articleId), summaryTimeoutMs, '临时摘要生成');
  if (!result.summary) {
    throw new Error('AI 摘要生成失败');
  }

  await updateCollectJob(jobId, {
    resultJson: {
      summary: result.summary,
      category: result.category,
      tags: result.tags,
      savedToInbox: false,
    },
  });
}

async function processWechatJob(jobId: number, normalizedUrl: string, options: { saveToInbox: boolean; userId?: number | null; clientId?: number | null; sourceType?: string }) {
  const title = normalizedUrl;
  const source = '微信公众号';
  const articleId = await upsertArticleFromCapture({
    normalizedUrl,
    title,
    source,
    method: 'reader',
  }, {
    persistMetadata: options.saveToInbox,
    userId: options.userId,
    clientId: options.clientId,
    sourceType: options.sourceType,
    markArchived: options.sourceType !== 'mcp',
  });

  await updateCollectJob(jobId, { stage: 'reader_fetch', captureStrategy: 'wechat_reader', articleId, title });

  // 用 json 格式抓取公众号结构化数据，填充 articles.content.content_noencode，
  // 作为 html/markdown 空壳页的兜底数据源（既有 content_noencode 提取逻辑会消费它）
  const wechatJson = await fetchWechatJson(normalizedUrl).catch((e) => {
    console.error('Wechat json fetch failed:', (e as Error).message);
    return null;
  });
  let finalTitle = title;
  let finalSource = source;
  if (wechatJson && wechatJson.content_noencode) {
    await db
      .update(articles)
      .set({
        content: {
          collectMethod: 'reader',
          collectSource: wechatJson.collect_source || 'reader_json',
          originalUrl: normalizedUrl,
          content_noencode: wechatJson.content_noencode,
          picture_page_info_list: wechatJson.picture_page_info_list ?? [],
        },
        ...(typeof wechatJson.title === 'string' && wechatJson.title ? { title: wechatJson.title } : {}),
        ...(typeof wechatJson.nick_name === 'string' && wechatJson.nick_name ? { source: wechatJson.nick_name } : {}),
        updatedAt: new Date(),
      })
      .where(eq(articles.id, articleId));
    if (typeof wechatJson.title === 'string' && wechatJson.title) finalTitle = wechatJson.title;
    if (typeof wechatJson.nick_name === 'string' && wechatJson.nick_name) finalSource = wechatJson.nick_name;
    await updateCollectJob(jobId, { title: finalTitle });
  } else {
    const pageMeta = await fetchWechatPageMeta(normalizedUrl);
    if (pageMeta?.title) finalTitle = pageMeta.title;
    if (pageMeta?.source) finalSource = pageMeta.source;
    if (pageMeta?.title || pageMeta?.source) {
      await db
        .update(articles)
        .set({ title: finalTitle, source: finalSource, updatedAt: new Date() })
        .where(eq(articles.id, articleId));
      await updateCollectJob(jobId, { title: finalTitle });
    }
  }

  if (options.saveToInbox) {
    const contentResults = await Promise.allSettled([
      getArticleContent(articleId, 'html', 'desktop', options.userId ?? undefined),
      getArticleContent(articleId, 'markdown', 'desktop', options.userId ?? undefined),
    ]);
    const hasCapturedContent = contentResults.some(
      (result) => result.status === 'fulfilled' && typeof result.value === 'string' && result.value.trim().length > 0
    );

    if (!hasCapturedContent) {
      throw new Error('微信公众号正文抓取失败：所有可用抓取方式均未返回有效正文');
    }
  }
  if (options.saveToInbox) {
    await updateCollectJob(jobId, {
      status: 'completed',
      stage: 'completed',
      error: null,
      articleId,
      finishedAt: new Date(),
    });
    await finishArticleSideEffects(jobId, articleId, { saveToInbox: true, userId: options.userId });
    return;
  }

  await updateCollectJob(jobId, { stage: 'summarizing', articleId });
  await finishArticleSideEffects(jobId, articleId, { saveToInbox: false });
  await updateCollectJob(jobId, {
    status: 'completed',
    stage: 'completed',
    error: null,
    articleId,
    finishedAt: new Date(),
  });
}

type PreparedCapture = ReturnType<typeof prepareCapturedDocument>;

type ValidSingleFileCapture = {
  strategy: CollectCaptureStrategy;
  captureUrl: string;
  desktopCaptureUrl: string | null;
  mobileCaptureUrl: string | null;
  desktopRawHtml: string | null;
  mobileRawHtml: string | null;
  desktopPrepared: PreparedCapture | null;
  mobilePrepared: PreparedCapture | null;
  primaryPrepared: PreparedCapture;
  primaryRawHtml: string;
};

type MinimalSingleFileCapture = {
  strategy: CollectCaptureStrategy;
  captureUrl: string;
  primaryPrepared: PreparedCapture;
  primaryRawHtml: string;
  variant: HtmlVariant;
};

function formatStrategyLabel(strategy: CollectCaptureStrategy) {
  if (strategy === 'singlefile_sidecar') return 'Sidecar';
  if (strategy === 'singlefile_command') return 'single-file 命令';
  if (strategy === 'singlefile_docker') return 'Docker 兜底';
  if (strategy === 'singlefile_npx') return 'npx 兜底';
  return strategy;
}

function pushUniqueUrl(urls: string[], value: string) {
  try {
    const normalized = new URL(value);
    normalized.hash = '';
    const finalValue = normalized.toString();
    if (!urls.includes(finalValue)) urls.push(finalValue);
  } catch {
    // Ignore malformed candidate URLs; the original URL was validated earlier.
  }
}

function getCaptureUrlCandidates(normalizedUrl: string) {
  const candidates: string[] = [];
  pushUniqueUrl(candidates, normalizedUrl);

  let parsed: URL;
  try {
    parsed = new URL(normalizedUrl);
  } catch {
    return candidates;
  }

  if (parsed.search) {
    const withoutSearch = new URL(parsed);
    withoutSearch.search = '';
    pushUniqueUrl(candidates, withoutSearch.toString());
  }

  const host = parsed.hostname.toLowerCase();
  if (host === 'post.m.smzdm.com' || host === 'm.smzdm.com') {
    const desktopUrl = new URL(parsed);
    desktopUrl.hostname = host === 'post.m.smzdm.com' ? 'post.smzdm.com' : 'www.smzdm.com';
    pushUniqueUrl(candidates, desktopUrl.toString());
    desktopUrl.search = '';
    pushUniqueUrl(candidates, desktopUrl.toString());
  }

  return candidates;
}

function formatCandidateLabel(originalUrl: string, captureUrl: string) {
  if (captureUrl === originalUrl) return '';
  try {
    const parsed = new URL(captureUrl);
    return ` @ ${parsed.hostname}${parsed.pathname}`;
  } catch {
    return ` @ ${captureUrl}`;
  }
}

async function captureVariantWithStrategy(
  jobId: number,
  captureUrl: string,
  strategy: CollectCaptureStrategy,
  variant: HtmlVariant
) {
  await updateCollectJob(jobId, {
    stage: variant === 'desktop' ? 'capturing' : 'capturing_mobile',
    captureStrategy: strategy,
  });

  const { html } = await runSingleFileWithStrategy(captureUrl, variant, strategy);
  const validation = validateCapturedHtml(html, captureUrl);
  if (!validation.ok) {
    throw new Error(`${validation.reason}（正文长度 ${validation.textLength}）`);
  }

  return {
    rawHtml: html,
    prepared: prepareCapturedDocument(html, captureUrl),
  };
}

async function captureMinimalSingleFile(jobId: number, normalizedUrl: string): Promise<MinimalSingleFileCapture> {
  const strategyFailures: string[] = [];
  const captureUrls = getCaptureUrlCandidates(normalizedUrl);
  const strategies = getSingleFileCandidateStrategies();

  if (strategies.length === 0) {
    throw new Error('当前运行环境没有可用的网页抓取执行器，请启动 SingleFile sidecar，或安装 single-file/npx 与 Chromium');
  }

  for (const captureUrl of captureUrls) {
    const candidateLabel = formatCandidateLabel(normalizedUrl, captureUrl);

    for (const strategy of strategies) {
      try {
        const desktop = await captureVariantWithStrategy(jobId, captureUrl, strategy, 'desktop');
        return {
          strategy,
          captureUrl,
          primaryPrepared: desktop.prepared,
          primaryRawHtml: desktop.rawHtml,
          variant: 'desktop',
        };
      } catch (desktopError) {
        const desktopMessage = desktopError instanceof Error ? desktopError.message : String(desktopError);
        console.warn(`${formatStrategyLabel(strategy)} desktop capture failed for ${captureUrl}: ${desktopMessage}`);

        try {
          const mobile = await captureVariantWithStrategy(jobId, captureUrl, strategy, 'mobile');
          return {
            strategy,
            captureUrl,
            primaryPrepared: mobile.prepared,
            primaryRawHtml: mobile.rawHtml,
            variant: 'mobile',
          };
        } catch (mobileError) {
          const mobileMessage = mobileError instanceof Error ? mobileError.message : String(mobileError);
          console.warn(`${formatStrategyLabel(strategy)} mobile capture failed for ${captureUrl}: ${mobileMessage}`);
          strategyFailures.push(`${formatStrategyLabel(strategy)}${candidateLabel}：desktop: ${desktopMessage}；mobile: ${mobileMessage}`);
        }
      }
    }
  }

  throw new Error(strategyFailures.join('；') || 'SingleFile 抓取结果无有效正文');
}

async function captureBestSingleFile(jobId: number, normalizedUrl: string): Promise<ValidSingleFileCapture> {
  const strategyFailures: string[] = [];
  const captureUrls = getCaptureUrlCandidates(normalizedUrl);
  const strategies = getSingleFileCandidateStrategies();

  if (strategies.length === 0) {
    throw new Error('当前运行环境没有可用的网页抓取执行器，请启动 SingleFile sidecar，或安装 single-file/npx 与 Chromium');
  }

  for (const captureUrl of captureUrls) {
    const candidateLabel = formatCandidateLabel(normalizedUrl, captureUrl);

    for (const strategy of strategies) {
      const variantFailures: string[] = [];
      let desktopRawHtml: string | null = null;
      let mobileRawHtml: string | null = null;
      let desktopPrepared: PreparedCapture | null = null;
      let mobilePrepared: PreparedCapture | null = null;
      let desktopCaptureUrl: string | null = null;
      let mobileCaptureUrl: string | null = null;

      try {
        const desktop = await captureVariantWithStrategy(jobId, captureUrl, strategy, 'desktop');
        desktopRawHtml = desktop.rawHtml;
        desktopPrepared = desktop.prepared;
        desktopCaptureUrl = captureUrl;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        variantFailures.push(`desktop: ${message}`);
        console.warn(`${formatStrategyLabel(strategy)} desktop capture failed for ${captureUrl}: ${message}`);
      }

      try {
        const mobile = await captureVariantWithStrategy(jobId, captureUrl, strategy, 'mobile');
        mobileRawHtml = mobile.rawHtml;
        mobilePrepared = mobile.prepared;
        mobileCaptureUrl = captureUrl;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        variantFailures.push(`mobile: ${message}`);
        console.warn(`${formatStrategyLabel(strategy)} mobile capture failed for ${captureUrl}: ${message}`);
      }

      const primaryPrepared = desktopPrepared ?? mobilePrepared;
      const primaryRawHtml = desktopRawHtml ?? mobileRawHtml;
      if (primaryPrepared && primaryRawHtml) {
        return {
          strategy,
          captureUrl,
          desktopCaptureUrl,
          mobileCaptureUrl,
          desktopRawHtml,
          mobileRawHtml,
          desktopPrepared,
          mobilePrepared,
          primaryPrepared,
          primaryRawHtml,
        };
      }

      strategyFailures.push(
        `${formatStrategyLabel(strategy)}${candidateLabel}：${variantFailures.join('；') || '未返回有效正文'}`
      );
    }
  }

  throw new Error(strategyFailures.join('；') || 'SingleFile 抓取结果无有效正文');
}

async function processSingleFileJob(jobId: number, normalizedUrl: string, options: { saveToInbox: boolean; userId?: number | null; clientId?: number | null; sourceType?: string }) {
  await updateCollectJob(jobId, { stage: 'capturing', captureStrategy: getInitialSingleFileStrategy() });

  if (!options.saveToInbox) {
    const capture = await captureMinimalSingleFile(jobId, normalizedUrl);
    const primaryPrepared = capture.primaryPrepared;
    const primaryHtml = primaryPrepared.html;
    const contentMarkdown = extractTextFromHtml(primaryHtml);

    await updateCollectJob(jobId, {
      stage: 'saving',
      title: primaryPrepared.title,
      captureStrategy: capture.strategy,
    });

    const articleId = await upsertArticleFromCapture({
      normalizedUrl,
      title: primaryPrepared.title,
      source: primaryPrepared.source,
      contentHtml: primaryHtml,
      contentMarkdown,
      coverImage: primaryPrepared.coverImage,
      method: 'singlefile',
    }, { persistMetadata: false });

    await updateCollectJob(jobId, {
      stage: 'summarizing',
      articleId,
      title: primaryPrepared.title,
      captureStrategy: capture.strategy,
    });
    await finishArticleSideEffects(jobId, articleId, { saveToInbox: false });
    await updateCollectJob(jobId, {
      status: 'completed',
      stage: 'completed',
      error: null,
      articleId,
      title: primaryPrepared.title,
      captureStrategy: capture.strategy,
      finishedAt: new Date(),
    });
    return;
  }

  const capture = await captureBestSingleFile(jobId, normalizedUrl);
  await updateCollectJob(jobId, { stage: 'uploading_images', captureStrategy: capture.strategy });

  const desktopUploadPromise = capture.desktopPrepared
    ? uploadImagesInCapturedDocument(capture.desktopPrepared.html, capture.desktopCaptureUrl || capture.captureUrl, uploadImage)
    : Promise.resolve(null);
  const mobileUploadPromise = capture.mobilePrepared
    ? uploadImagesInCapturedDocument(capture.mobilePrepared.html, capture.mobileCaptureUrl || capture.captureUrl, uploadImage)
    : Promise.resolve(null);
  const coverUploadPromise = capture.primaryPrepared.coverImage ? uploadImage(capture.primaryPrepared.coverImage) : Promise.resolve(null);
  const [desktopHtml, mobileHtml, uploadedCoverImage] = await Promise.all([
    desktopUploadPromise,
    mobileUploadPromise,
    coverUploadPromise,
  ]);

  const primaryHtml = desktopHtml ?? mobileHtml ?? capture.primaryRawHtml;
  const primaryPrepared = capture.primaryPrepared;

  const contentMarkdown = extractTextFromHtml(primaryHtml);
  await updateCollectJob(jobId, { stage: 'saving', title: primaryPrepared.title });
  const articleId = await upsertArticleFromCapture({
    normalizedUrl,
    title: primaryPrepared.title,
    source: primaryPrepared.source,
    contentHtml: primaryHtml,
    contentHtmlMobile: mobileHtml,
    contentMarkdown,
    coverImage: uploadedCoverImage || primaryPrepared.coverImage,
    method: 'singlefile',
  }, { persistMetadata: true, userId: options.userId, clientId: options.clientId, sourceType: options.sourceType, markArchived: options.sourceType !== 'mcp' });

  await updateCollectJob(jobId, {
    status: 'completed',
    stage: 'completed',
    error: null,
    articleId,
    title: primaryPrepared.title,
    captureStrategy: capture.strategy,
    finishedAt: new Date(),
  });
  await finishArticleSideEffects(jobId, articleId, { saveToInbox: true, userId: options.userId });
}

export async function initCollectSchema() {
  await db.execute(sql.raw(COLLECT_TABLE_SQL));
  await db.execute(sql.raw(`ALTER TABLE collect_jobs ADD COLUMN IF NOT EXISTS capture_strategy TEXT`));
  await db.execute(sql.raw(`ALTER TABLE collect_jobs ADD COLUMN IF NOT EXISTS user_id INTEGER REFERENCES users(id) ON DELETE SET NULL`));
  await db.execute(sql.raw(`ALTER TABLE collect_jobs ADD COLUMN IF NOT EXISTS client_id INTEGER REFERENCES mcp_clients(id) ON DELETE SET NULL`));
  await db.execute(sql.raw(`ALTER TABLE collect_jobs ADD COLUMN IF NOT EXISTS request_source TEXT NOT NULL DEFAULT 'web'`));
  await db.execute(sql.raw(`ALTER TABLE collect_jobs ADD COLUMN IF NOT EXISTS save_to_inbox BOOLEAN NOT NULL DEFAULT TRUE`));
  await db.execute(sql.raw(`ALTER TABLE collect_jobs ADD COLUMN IF NOT EXISTS result_json JSONB`));
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  await db.execute(sql`
    UPDATE collect_jobs
    SET user_id = (SELECT id FROM users WHERE username = ${adminUsername} LIMIT 1)
    WHERE user_id IS NULL
      AND request_source = 'web'
  `);
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

function canAccessCollectJob(job: typeof collectJobs.$inferSelect, filter: CollectJobAccessFilter = {}) {
  if (filter.userId !== undefined && job.userId !== filter.userId) return false;
  if (filter.clientId !== undefined && job.clientId !== filter.clientId) return false;
  if (filter.requestSource !== undefined && job.requestSource !== filter.requestSource) return false;
  return true;
}

function buildCollectJobWhere(filter: CollectJobAccessFilter = {}) {
  const conditions = [];
  if (filter.userId !== undefined) conditions.push(eq(collectJobs.userId, filter.userId));
  if (filter.clientId !== undefined) conditions.push(eq(collectJobs.clientId, filter.clientId));
  if (filter.requestSource !== undefined) conditions.push(eq(collectJobs.requestSource, filter.requestSource));
  if (conditions.length === 0) return undefined;
  return conditions.length === 1 ? conditions[0] : and(...conditions);
}

export async function createCollectJob(rawUrl: string, options: CreateCollectJobOptions = {}) {
  const normalizedUrl = normalizeCollectUrl(rawUrl);
  await assertSafeOutboundUrl(normalizedUrl);

  const method: CollectMethod = isWechatUrl(normalizedUrl) ? 'reader' : 'singlefile';
  const requestSource = options.requestSource ?? 'web';
  if (requestSource === 'web' && options.userId !== undefined && options.userId !== null) {
    const [{ activeJobs }] = await db
      .select({ activeJobs: sql<number>`count(*)::int` })
      .from(collectJobs)
      .where(and(
        eq(collectJobs.userId, options.userId),
        eq(collectJobs.requestSource, 'web'),
        inArray(collectJobs.status, ['pending', 'running']),
      ));
    if (activeJobs >= MAX_ACTIVE_WEB_COLLECT_JOBS_PER_USER) {
      throw new Error('当前进行中的采集任务过多，请等待现有任务完成后再试');
    }
  }
  const [job] = await db
    .insert(collectJobs)
    .values({
      url: rawUrl.trim(),
      normalizedUrl,
      userId: options.userId ?? null,
      clientId: options.clientId ?? null,
      requestSource,
      saveToInbox: options.saveToInbox ?? true,
      status: 'pending',
      stage: 'queued',
      method,
      captureStrategy: method === 'reader' ? 'wechat_reader' : null,
    })
    .returning();

  if (requestSource === 'web') {
    scheduleWebCollectJobs();
  } else if (requestSource === 'mcp') {
    scheduleMcpCollectJobs();
  } else {
    void processCollectJob(job.id).catch((e) => console.error(`Collect job ${job.id} failed:`, e.message));
  }
  return job;
}

async function runNextWebCollectJob() {
  const [job] = await db
    .select()
    .from(collectJobs)
    .where(and(eq(collectJobs.requestSource, 'web'), eq(collectJobs.status, 'pending')))
    .orderBy(asc(collectJobs.createdAt), asc(collectJobs.id))
    .limit(1);

  if (!job) return false;
  await processCollectJob(job.id);
  return true;
}

export function scheduleWebCollectJobs() {
  while (activeWebCollectWorkers < WEB_COLLECT_CONCURRENCY) {
    activeWebCollectWorkers += 1;
    void runNextWebCollectJob()
      .catch((error) => console.error('Web collect worker failed:', error instanceof Error ? error.message : error))
      .then((processed) => {
        activeWebCollectWorkers -= 1;
        if (processed) scheduleWebCollectJobs();
      });
  }
}

async function runNextMcpCollectJob() {
  const [job] = await db
    .select()
    .from(collectJobs)
    .where(and(eq(collectJobs.requestSource, 'mcp'), eq(collectJobs.status, 'pending')))
    .orderBy(asc(collectJobs.createdAt), asc(collectJobs.id))
    .limit(1);

  if (!job) return false;
  await processCollectJob(job.id);
  return true;
}

export function scheduleMcpCollectJobs() {
  while (activeMcpCollectWorkers < MCP_COLLECT_CONCURRENCY) {
    activeMcpCollectWorkers += 1;
    void runNextMcpCollectJob()
      .catch((error) => console.error('MCP collect worker failed:', error instanceof Error ? error.message : error))
      .then((processed) => {
        activeMcpCollectWorkers -= 1;
        if (processed) scheduleMcpCollectJobs();
      });
  }
}

/**
 * A process restart interrupts in-memory collection work. Requeue every
 * non-terminal Web and MCP job immediately, then restart their respective
 * workers so neither source can remain permanently stuck in `running`.
 */
export async function resumePendingCollectJobs() {
  await db
    .update(collectJobs)
    .set({ status: 'pending', stage: 'queued', startedAt: null, updatedAt: new Date() })
    .where(and(
      inArray(collectJobs.requestSource, ['web', 'mcp']),
      eq(collectJobs.status, 'running'),
    ));
  scheduleWebCollectJobs();
  scheduleMcpCollectJobs();
}

export async function retryCollectJob(jobId: number) {
  const [job] = await db
    .update(collectJobs)
    .set({ status: 'pending', stage: 'queued', error: null, startedAt: null, finishedAt: null, updatedAt: new Date() })
    .where(eq(collectJobs.id, jobId))
    .returning();

  if (job?.requestSource === 'web') {
    scheduleWebCollectJobs();
  } else if (job?.requestSource === 'mcp') {
    scheduleMcpCollectJobs();
  } else if (job) {
    void processCollectJob(job.id).catch((error) => console.error(`Collect job ${job.id} failed:`, error instanceof Error ? error.message : error));
  }
}

export async function processCollectJob(jobId: number) {
  // Multiple MCP workers may observe the same pending row. Claim it in the
  // database first so only one worker can perform the article/meta writes.
  const [job] = await db
    .update(collectJobs)
    .set({ status: 'running', stage: 'starting', startedAt: new Date(), error: null, updatedAt: new Date() })
    .where(and(eq(collectJobs.id, jobId), eq(collectJobs.status, 'pending')))
    .returning();

  if (!job) {
    const [existing] = await db.select().from(collectJobs).where(eq(collectJobs.id, jobId)).limit(1);
    return existing;
  }

  try {
    if (job.method === 'reader') {
      await processWechatJob(jobId, job.normalizedUrl, { saveToInbox: job.saveToInbox, userId: job.userId, clientId: job.clientId, sourceType: job.requestSource });
    } else {
      await processSingleFileJob(jobId, job.normalizedUrl, { saveToInbox: job.saveToInbox, userId: job.userId, clientId: job.clientId, sourceType: job.requestSource });
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

export async function getCollectJob(jobId: number, filter: CollectJobAccessFilter = {}) {
  const [job] = await db.select().from(collectJobs).where(eq(collectJobs.id, jobId)).limit(1);
  if (!job || !canAccessCollectJob(job, filter)) return null;
  return normalizeCollectJobStrategy(job);
}

const collectJobWait = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

/**
 * Wait for a collect job at the API boundary without making an MCP client poll repeatedly.
 * A non-terminal result after the deadline is still a running job, not a capture failure.
 */
export async function waitForCollectJob(jobId: number, filter: CollectJobAccessFilter = {}, timeoutMs = 0) {
  const deadline = Date.now() + Math.max(0, timeoutMs);
  let job = await getCollectJob(jobId, filter);

  while (job && (job.status === 'pending' || job.status === 'running') && Date.now() < deadline) {
    await collectJobWait(Math.min(1000, Math.max(1, deadline - Date.now())));
    job = await getCollectJob(jobId, filter);
  }

  return job;
}

export async function listCollectJobs(limit = 12, offset = 0, filter: CollectJobAccessFilter = {}) {
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const safeOffset = Math.max(offset, 0);
  const whereCondition = buildCollectJobWhere(filter);
  const jobs = await db
    .select()
    .from(collectJobs)
    .where(whereCondition)
    .orderBy(desc(collectJobs.createdAt))
    .limit(safeLimit)
    .offset(safeOffset);
  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(collectJobs)
    .where(whereCondition);

  return {
    jobs: jobs.map(normalizeCollectJobStrategy),
    total,
    hasMore: safeOffset + jobs.length < total,
  };
}

export async function deleteCollectJob(jobId: number, filter: CollectJobAccessFilter = {}) {
  const job = await getCollectJob(jobId, filter);
  if (!job) return { deleted: false, reason: 'not_found' as const };
  if (job.status === 'running') return { deleted: false, reason: 'running' as const };

  await db.delete(collectJobs).where(eq(collectJobs.id, jobId));
  return { deleted: true, reason: null };
}

export async function clearFinishedCollectJobs(filter: CollectJobAccessFilter = {}) {
  const whereCondition = buildCollectJobWhere(filter);
  const deleted = await db
    .delete(collectJobs)
    .where(whereCondition ? and(whereCondition, inArray(collectJobs.status, ['completed', 'failed'])) : inArray(collectJobs.status, ['completed', 'failed']))
    .returning({ id: collectJobs.id });

  return { deletedCount: deleted.length };
}
