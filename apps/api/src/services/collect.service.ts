import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { articleMetadata, articles, collectJobs } from '../db/schema.js';
import { buildArticleSummaryResult } from './ai.service.js';
import { allocateArticleIdInTransaction } from './article-id.service.js';
import { coverImageBackfillQueue } from './cover-image-backfill.service.js';
import { assertSafeOutboundUrl, normalizeOutboundUrl } from './outbound-url-policy.service.js';
import { ensureArticleMetadataContentHtmlMobileColumn, uploadImage } from './reader.service.js';
import { captureWechatArticleInMemory } from './wechat-collect-capture.service.js';
import {
  type CollectCaptureStrategy,
  type HtmlVariant,
  extractTextFromHtml,
  getInitialSingleFileStrategy,
  getSingleFileCandidateStrategies,
  fetchReadableProxyHtml,
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
type CollectRequestSource = 'web' | 'android' | 'android_share' | 'browser_extension' | 'macos' | 'mcp' | 'api' | 'system';
const FIRST_PARTY_COLLECT_SOURCES: CollectRequestSource[] = ['web', 'android', 'android_share', 'browser_extension', 'macos'];
export const USER_COLLECT_SOURCES: CollectRequestSource[] = [...FIRST_PARTY_COLLECT_SOURCES, 'mcp'];

type CreateCollectJobOptions = {
  userId?: number | null;
  clientId?: number | null;
  requestSource?: CollectRequestSource;
  saveToInbox?: boolean;
};

type CollectJobAccessFilter = {
  userId?: number;
  clientId?: number;
  requestSource?: CollectRequestSource | CollectRequestSource[];
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
export type CollectPersistence = {
  articleId: number;
  createdArticle: boolean;
  createdMetadata: boolean;
};

type CollectCaptureInput = {
  normalizedUrl: string;
  title: string;
  source: string;
  contentHtml?: string | null;
  contentHtmlMobile?: string | null;
  contentMarkdown?: string | null;
  content?: unknown;
  coverImage?: string | null;
  method: CollectMethod;
};

type CollectCaptureOptions = {
  persistMetadata?: boolean;
  userId?: number | null;
  clientId?: number | null;
  sourceType?: string;
  markArchived?: boolean;
};

export type CollectTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

export async function upsertArticleFromCaptureInTransaction(
  tx: CollectTransaction,
  input: CollectCaptureInput,
  options: CollectCaptureOptions = {},
): Promise<CollectPersistence> {
  const persistMetadata = options.persistMetadata ?? true;
  if (persistMetadata && !options.userId) throw new Error('保存文章到收件箱需要用户归属');

  // URL 锁只覆盖短暂持久化事务，不跨网络抓取持有连接。
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('storing:collect-url'), hashtext(${input.normalizedUrl}))`);
  const [existing] = await tx
      .select({ id: articles.id })
      .from(articles)
      .where(eq(articles.originalUrl, input.normalizedUrl))
      .limit(1);

  const now = new Date();
  let articleId = existing?.id;
  const createdArticle = !articleId;

  if (articleId) {
    const articleValues: Partial<typeof articles.$inferInsert> = {
      title: input.title,
      source: input.source,
      coverImage: input.coverImage ?? undefined,
      contentHtml: input.contentHtml ?? undefined,
      contentMarkdown: input.contentMarkdown ?? undefined,
      content: input.content === undefined ? undefined : input.content,
      updatedAt: now,
    };
    await tx.update(articles).set(articleValues).where(eq(articles.id, articleId));
  } else {
    articleId = await allocateArticleIdInTransaction(tx);
    await tx.insert(articles).values({
      id: articleId,
      title: input.title,
      source: input.source,
      originalUrl: input.normalizedUrl,
      contentHtml: input.contentHtml ?? null,
      contentMarkdown: input.contentMarkdown ?? null,
      coverImage: input.coverImage ?? null,
      content: input.content ?? { collectMethod: input.method, originalUrl: input.normalizedUrl },
      readStatus: 'unread',
      createdAt: now,
      updatedAt: now,
    });
  }

  if (!persistMetadata || !options.userId) {
    return {
      articleId,
      createdArticle,
      createdMetadata: false,
    };
  }

  const [meta] = await tx
      .select({ id: articleMetadata.id })
      .from(articleMetadata)
      .where(and(eq(articleMetadata.articleId, articleId), eq(articleMetadata.userId, options.userId)));

  // 只有正文验证通过后才会进入这个事务，因此可以直接把文章放回收件箱。
  const markArchived = false;
  const metadataValues: Partial<typeof articleMetadata.$inferInsert> = {
    isDeleted: false,
    isArchived: markArchived,
    archivedAt: markArchived ? now : null,
    // 新一次采集可能带来新封面，重置版本让统一队列重新处理。
    coverVersion: 0,
    updatedAt: now,
  };
  if (input.contentHtml !== undefined) metadataValues.contentHtml = input.contentHtml;
  if (input.contentHtmlMobile !== undefined) metadataValues.contentHtmlMobile = input.contentHtmlMobile;
  if (input.contentMarkdown !== undefined) metadataValues.contentMd = input.contentMarkdown;
  if (input.coverImage !== undefined) metadataValues.coverImage = input.coverImage;

  if (meta) {
    await tx
        .update(articleMetadata)
        .set(metadataValues)
        .where(and(eq(articleMetadata.articleId, articleId), eq(articleMetadata.userId, options.userId)));
  } else {
    await tx.insert(articleMetadata).values({
      articleId,
      userId: options.userId,
      clientId: options.clientId ?? null,
      sourceType: options.sourceType ?? 'web',
      isFavorited: false,
      ...metadataValues,
    });
  }

  return {
    articleId,
    createdArticle,
    createdMetadata: !meta,
  };
}

async function upsertArticleFromCapture(
  input: CollectCaptureInput,
  options: CollectCaptureOptions = {},
): Promise<CollectPersistence> {
  return db.transaction((tx) => upsertArticleFromCaptureInTransaction(tx, input, options));
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

async function finishArticleSideEffects(jobId: number, articleId: number, options: { saveToInbox: boolean; userId?: number | null; coverProcessed?: boolean }) {
  if (options.saveToInbox) {
    if (!options.userId) throw new Error('保存文章到收件箱需要用户归属');
    if (!options.coverProcessed) {
      coverImageBackfillQueue.enqueue([{ articleId, userId: options.userId }]);
    }
    return;
  }

  const summaryTimeoutMs = Number(process.env.SUMMARY_ONLY_TIMEOUT_MS || 120000);
  if (!options.userId) throw new Error('AI_NOT_CONFIGURED');
  const result = await withTimeout(buildArticleSummaryResult(articleId, options.userId), summaryTimeoutMs, '临时摘要生成');
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
  await updateCollectJob(jobId, { stage: 'reader_fetch', captureStrategy: 'wechat_reader', title: normalizedUrl });

  // 所有候选数据只保存在内存中；正文验证成功前不写共享文章或用户元数据。
  const capture = await captureWechatArticleInMemory(normalizedUrl);
  await updateCollectJob(jobId, { stage: 'saving', title: capture.title });
  const persistence = await upsertArticleFromCapture({
    normalizedUrl,
    title: capture.title,
    source: capture.source,
    contentHtml: capture.contentHtml,
    contentMarkdown: capture.contentMarkdown,
    content: capture.content,
    coverImage: capture.coverImage,
    method: 'reader',
  }, {
    persistMetadata: options.saveToInbox,
    userId: options.userId,
    clientId: options.clientId,
    sourceType: options.sourceType,
    markArchived: false,
  });
  const { articleId } = persistence;

  if (!options.saveToInbox) {
    await updateCollectJob(jobId, { stage: 'summarizing', articleId });
    await finishArticleSideEffects(jobId, articleId, { saveToInbox: false });
    await updateCollectJob(jobId, {
      status: 'completed',
      stage: 'completed',
      error: null,
      articleId,
      finishedAt: new Date(),
    });
    return;
  }

  if (!options.userId) throw new Error('保存文章到收件箱需要用户归属');
  // 文章已经通过正文校验并原子入库；封面统一交给有界后台队列。
  coverImageBackfillQueue.enqueue([{ articleId, userId: options.userId }]);
  await updateCollectJob(jobId, {
    status: 'completed',
    stage: 'completed',
    error: null,
    articleId,
    finishedAt: new Date(),
  });
  await finishArticleSideEffects(jobId, articleId, {
    saveToInbox: true,
    userId: options.userId,
    coverProcessed: true,
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
  if (strategy === 'reader_proxy') return 'Reader 兜底';
  if (strategy === 'singlefile_command') return 'single-file 命令';
  if (strategy === 'singlefile_docker') return 'Docker 兜底';
  if (strategy === 'singlefile_npx') return 'npx 兜底';
  return strategy;
}

async function captureReadableProxy(
  jobId: number,
  normalizedUrl: string
): Promise<ValidSingleFileCapture & { variant: HtmlVariant }> {
  await updateCollectJob(jobId, { stage: 'capturing_reader', captureStrategy: 'reader_proxy' });
  const rawHtml = await fetchReadableProxyHtml(normalizedUrl);
  const validation = validateCapturedHtml(rawHtml, normalizedUrl);
  if (!validation.ok) {
    throw new Error(`${validation.reason}（正文长度 ${validation.textLength}）`);
  }

  return {
    strategy: 'reader_proxy',
    captureUrl: normalizedUrl,
    desktopCaptureUrl: null,
    mobileCaptureUrl: null,
    desktopRawHtml: null,
    mobileRawHtml: null,
    desktopPrepared: null,
    mobilePrepared: null,
    primaryPrepared: prepareCapturedDocument(rawHtml, normalizedUrl),
    primaryRawHtml: rawHtml,
    variant: 'desktop',
  };
}

async function appendReadableProxyCapture(
  jobId: number,
  normalizedUrl: string,
  strategyFailures: string[]
): Promise<(ValidSingleFileCapture & { variant: HtmlVariant }) | null> {
  try {
    return await captureReadableProxy(jobId, normalizedUrl);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    strategyFailures.push(`Reader 兜底：${message}`);
    return null;
  }
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

  const readableCapture = await appendReadableProxyCapture(jobId, normalizedUrl, strategyFailures);
  if (readableCapture) return readableCapture;
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

  const readableCapture = await appendReadableProxyCapture(jobId, normalizedUrl, strategyFailures);
  if (readableCapture) return readableCapture;
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

    const persistence = await upsertArticleFromCapture({
      normalizedUrl,
      title: primaryPrepared.title,
      source: primaryPrepared.source,
      contentHtml: primaryHtml,
      contentMarkdown,
      coverImage: primaryPrepared.coverImage,
      method: 'singlefile',
    }, { persistMetadata: false });
    const { articleId } = persistence;

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
  const persistence = await upsertArticleFromCapture({
    normalizedUrl,
    title: primaryPrepared.title,
    source: primaryPrepared.source,
    contentHtml: primaryHtml,
    contentHtmlMobile: mobileHtml,
    contentMarkdown,
    coverImage: uploadedCoverImage || primaryPrepared.coverImage,
    method: 'singlefile',
  }, { persistMetadata: true, userId: options.userId, clientId: options.clientId, sourceType: options.sourceType, markArchived: false });
  const { articleId } = persistence;

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
  await db.execute(sql.raw(`ALTER TABLE collect_jobs ADD COLUMN IF NOT EXISTS owner_deleted BOOLEAN NOT NULL DEFAULT FALSE`));
  await db.execute(sql.raw(`ALTER TABLE collect_jobs ADD COLUMN IF NOT EXISTS result_json JSONB`));
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  await db.execute(sql`
    UPDATE collect_jobs
    SET user_id = (SELECT id FROM users WHERE username = ${adminUsername} LIMIT 1)
    WHERE user_id IS NULL
      AND request_source = 'web'
      AND owner_deleted = FALSE
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
  if (filter.requestSource !== undefined && !(Array.isArray(filter.requestSource) ? filter.requestSource : [filter.requestSource]).includes(job.requestSource as CollectRequestSource)) return false;
  return true;
}

function buildCollectJobWhere(filter: CollectJobAccessFilter = {}) {
  const conditions = [];
  if (filter.userId !== undefined) conditions.push(eq(collectJobs.userId, filter.userId));
  if (filter.clientId !== undefined) conditions.push(eq(collectJobs.clientId, filter.clientId));
  if (filter.requestSource !== undefined) {
    const sources = Array.isArray(filter.requestSource) ? filter.requestSource : [filter.requestSource];
    conditions.push(sources.length === 1 ? eq(collectJobs.requestSource, sources[0]) : inArray(collectJobs.requestSource, sources));
  }
  if (conditions.length === 0) return undefined;
  return conditions.length === 1 ? conditions[0] : and(...conditions);
}

export async function createCollectJob(rawUrl: string, options: CreateCollectJobOptions = {}) {
  const normalizedUrl = normalizeCollectUrl(rawUrl);
  await assertSafeOutboundUrl(normalizedUrl);

  const method: CollectMethod = isWechatUrl(normalizedUrl) ? 'reader' : 'singlefile';
  const requestSource = options.requestSource ?? 'web';
  if (requestSource !== 'mcp' && options.userId !== undefined && options.userId !== null) {
    const [{ activeJobs }] = await db
      .select({ activeJobs: sql<number>`count(*)::int` })
      .from(collectJobs)
      .where(and(
        eq(collectJobs.userId, options.userId),
        inArray(collectJobs.requestSource, FIRST_PARTY_COLLECT_SOURCES),
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

  if (FIRST_PARTY_COLLECT_SOURCES.includes(requestSource)) {
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
    .where(and(
      inArray(collectJobs.requestSource, ['web', 'android', 'android_share', 'browser_extension', 'macos']),
      eq(collectJobs.status, 'pending'),
      eq(collectJobs.ownerDeleted, false),
    ))
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
    .where(and(eq(collectJobs.requestSource, 'mcp'), eq(collectJobs.status, 'pending'), eq(collectJobs.ownerDeleted, false)))
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
      inArray(collectJobs.requestSource, ['web', 'android', 'android_share', 'browser_extension', 'macos', 'mcp']),
      eq(collectJobs.status, 'running'),
      eq(collectJobs.ownerDeleted, false),
    ));
  scheduleWebCollectJobs();
  scheduleMcpCollectJobs();
}

export async function retryCollectJob(jobId: number) {
  const [job] = await db
    .update(collectJobs)
    .set({ status: 'pending', stage: 'queued', error: null, startedAt: null, finishedAt: null, updatedAt: new Date() })
    .where(and(eq(collectJobs.id, jobId), eq(collectJobs.ownerDeleted, false)))
    .returning();

  if (job?.requestSource !== 'mcp') {
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
    .where(and(eq(collectJobs.id, jobId), eq(collectJobs.status, 'pending'), eq(collectJobs.ownerDeleted, false)))
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
