import { randomUUID } from 'node:crypto';
import { Hono } from 'hono';
import { db } from '../db/index.js';
import { articles, articleMetadata, users } from '../db/schema.js';
import { eq, and, asc, desc, count, sql, or, gt } from 'drizzle-orm';
import { generateSummaryAndTags } from '../services/ai.service.js';
import {
  ensureArticleMetadataContentHtmlMobileColumn,
  getArticleContent,
  processCoverImage,
  repairArticleDisplayMeta,
} from '../services/reader.service.js';
import { enqueueArticleForWiki, processWikiJobs, removeArticleFromWiki } from '../services/wiki.service.js';
import { requireAuth, optionalAuth, isAuthenticated, getCurrentUser } from '../middleware/auth.js';

export const articlesRoutes = new Hono();

type ArticleSortField = 'collected' | 'published' | 'favorited' | 'archived';
type SortOrder = 'asc' | 'desc';

async function getScopedUserId(c: any): Promise<number | null> {
  if (isAuthenticated(c)) return getCurrentUser(c).id as number;
  return null;
}

function metadataJoinCondition(userId: number) {
  return and(eq(articles.id, articleMetadata.articleId), eq(articleMetadata.userId, userId));
}

function metadataWhereCondition(articleId: number, userId: number) {
  return and(eq(articleMetadata.articleId, articleId), eq(articleMetadata.userId, userId));
}

function getViewCondition(view: string) {
  if (view === 'inbox') {
    return and(eq(articleMetadata.isArchived, false), eq(articleMetadata.isFavorited, false));
  }
  if (view === 'favorites') return eq(articleMetadata.isFavorited, true);
  if (view === 'archive') return eq(articleMetadata.isArchived, true);
  if (view === 'published') return eq(articleMetadata.isPublished, true);
  return and(eq(articleMetadata.isArchived, false), eq(articleMetadata.isFavorited, false));
}

let cachedHasActionTimestamps: boolean | null = null;

async function hasMetadataTimestampColumns() {
  if (cachedHasActionTimestamps !== null) return cachedHasActionTimestamps;
  try {
    const result = await db.execute(sql`
      SELECT COUNT(*)::int AS count
      FROM information_schema.columns
      WHERE table_name = 'article_metadata'
        AND column_name IN ('favorited_at', 'archived_at', 'published_at')
    `);
    cachedHasActionTimestamps = Number(result.rows[0]?.count ?? 0) >= 2;
  } catch {
    cachedHasActionTimestamps = false;
  }
  return cachedHasActionTimestamps;
}

function getDefaultArticleSort(view: string): ArticleSortField {
  if (view === 'favorites') return 'favorited';
  if (view === 'archive') return 'archived';
  if (view === 'published') return 'published';
  return 'collected';
}

function normalizeArticleSort(view: string, sort?: string): ArticleSortField {
  const defaultSort = getDefaultArticleSort(view);
  const allowedByView: Record<string, ArticleSortField[]> = {
    inbox: ['collected', 'published'],
    favorites: ['favorited', 'collected', 'published'],
    archive: ['archived', 'collected', 'published'],
    published: ['published', 'collected'],
  };
  const allowed = allowedByView[view] ?? allowedByView.inbox;
  return allowed.includes(sort as ArticleSortField) ? (sort as ArticleSortField) : defaultSort;
}

function normalizeSortOrder(order?: string): SortOrder {
  return order === 'asc' ? 'asc' : 'desc';
}

function getArticleSortExpression(sort: ArticleSortField, hasActionTimestamps: boolean) {
  if (sort === 'published' && hasActionTimestamps) return sql`coalesce(${articleMetadata.publishedAt}, ${articles.createdAt})`;
  if (sort === 'favorited' && hasActionTimestamps) return sql`coalesce(${articleMetadata.favoritedAt}, ${articles.createdAt})`;
  if (sort === 'archived' && hasActionTimestamps) return sql`coalesce(${articleMetadata.archivedAt}, ${articles.createdAt})`;
  if (sort === 'published') return articles.publishTime;
  if (sort === 'favorited' || sort === 'archived') return sql`coalesce(${articleMetadata.updatedAt}, ${articles.createdAt})`;
  return articles.createdAt;
}

function getArticleOrderBy(sort: ArticleSortField, order: SortOrder, hasActionTimestamps: boolean) {
  const expression = getArticleSortExpression(sort, hasActionTimestamps);
  return order === 'asc' ? asc(expression) : desc(expression);
}


/**
 * 确保 article_metadata 记录存在，不存在则创建
 */
async function ensureMetadata(userId: number, articleId: number) {
  const [existing] = await db
    .select({
      id: articleMetadata.id,
      articleId: articleMetadata.articleId,
      isFavorited: articleMetadata.isFavorited,
      isArchived: articleMetadata.isArchived,
    })
    .from(articleMetadata)
    .where(metadataWhereCondition(articleId, userId));

  if (existing) return existing;

  await db
    .insert(articleMetadata)
    .values({ articleId, userId, sourceType: 'web' });

  return {
    articleId,
    isFavorited: false,
    isArchived: false,
  };
}

async function getArticleRecord(id: number, userId: number) {
  const [article] = await db
    .select({
      id: articles.id,
      title: articles.title,
      author: articles.author,
      source: articles.source,
      originalUrl: articles.originalUrl,
      publishTime: articles.publishTime,
      metadataId: articleMetadata.id,
      favoritedAt: articleMetadata.favoritedAt,
      archivedAt: articleMetadata.archivedAt,
      articleCoverImage: articles.coverImage,
      metadataCoverImage: articleMetadata.coverImage,
      summary: articles.summary,
      commentary: articles.commentary,
      tags: articles.tags,
      readStatus: articles.readStatus,
      createdAt: articles.createdAt,
      isFavorited: articleMetadata.isFavorited,
      isArchived: articleMetadata.isArchived,
      isPublished: articleMetadata.isPublished,
      publishedAt: articleMetadata.publishedAt,
      publicId: articleMetadata.publicId,
      aiSummary: articleMetadata.aiSummary,
      aiCategory: articleMetadata.aiCategory,
      aiTags: articleMetadata.aiTags,
    })
    .from(articles)
    .innerJoin(articleMetadata, metadataJoinCondition(userId))
    .where(eq(articles.id, id));

  return article ?? null;
}

function serializeArticleRecord(article: NonNullable<Awaited<ReturnType<typeof getArticleRecord>>>) {
  const { articleCoverImage, metadataCoverImage, ...rest } = article;
  const isPublished = article.isPublished ?? false;

  return {
    ...rest,
    coverImage: metadataCoverImage || articleCoverImage,
    isFavorited: article.isFavorited ?? false,
    isArchived: article.isArchived ?? false,
    isPublished,
    publicUrl: isPublished && article.publicId ? `/p/${article.publicId}` : null,
    aiTags: article.aiTags ?? [],
  };
}

function serializePublicPublication(article: any) {
  return {
    id: article.id,
    publicId: article.publicId,
    publicUrl: `/p/${article.publicId}`,
    title: article.title,
    author: article.author,
    source: article.source,
    originalUrl: article.originalUrl,
    publishTime: article.publishTime,
    coverImage: article.coverImage,
    contentMd: article.contentMd,
    contentHtml: article.contentHtml,
    aiSummary: article.aiSummary,
    aiCategory: article.aiCategory,
    aiTags: article.aiTags ?? [],
    publishedAt: article.publishedAt,
    isPublished: true,
    isArchived: true,
    isFavorited: false,
  };
}

async function getPublicPublicationRecord(publicId: string) {
  const [article] = await db
    .select({
      id: articles.id,
      title: articles.title,
      author: articles.author,
      source: articles.source,
      originalUrl: articles.originalUrl,
      publishTime: articles.publishTime,
      coverImage: articleMetadata.coverImage,
      contentMd: articleMetadata.contentMd,
      contentHtml: articleMetadata.contentHtml,
      aiSummary: articleMetadata.aiSummary,
      aiCategory: articleMetadata.aiCategory,
      aiTags: articleMetadata.aiTags,
      publishedAt: articleMetadata.publishedAt,
      publicId: articleMetadata.publicId,
    })
    .from(articleMetadata)
    .innerJoin(articles, eq(articles.id, articleMetadata.articleId))
    .where(and(eq(articleMetadata.publicId, publicId), eq(articleMetadata.isPublished, true)))
    .limit(1);

  return article ?? null;
}

async function repairMissingDisplayMeta<T extends {
  id: number;
  title: string | null;
  author: string | null;
  source: string | null;
  publishTime: Date | string | null;
}>(rows: T[], userId: number): Promise<T[]> {
  const repairedRows = await Promise.all(rows.map(async (row) => {
    if (row.title && row.source && row.publishTime) return row;

    const repaired = await repairArticleDisplayMeta(row.id, userId);
    if (!repaired) return row;

    return {
      ...row,
      title: repaired.title || row.title,
      source: repaired.source || row.source,
      author: repaired.author || row.author,
      publishTime: repaired.publishTime || row.publishTime,
    };
  }));

  return repairedRows;
}

/**
 * GET /articles — 文章列表
 * 游客只能访问 archive 视图
 */
articlesRoutes.get('/articles', optionalAuth, async (c) => {
  const view = c.req.query('view') || 'inbox';
  const scope = c.req.query('scope');
  const category = c.req.query('category');
  const page = parseInt(c.req.query('page') || '1');
  const perPage = parseInt(c.req.query('perPage') || '8');
  const sort = normalizeArticleSort(view, c.req.query('sort'));
  const order = normalizeSortOrder(c.req.query('order'));
  const hasActionTimestamps = await hasMetadataTimestampColumns();

  if (view === 'published' && scope === 'mine') {
    if (!isAuthenticated(c)) {
      return c.json({ error: { code: 'FORBIDDEN', message: '请登录后访问' } }, 403);
    }

    const userId = getCurrentUser(c).id as number;
    const whereCondition = eq(articleMetadata.isPublished, true);
    const [{ total }] = await db
      .select({ total: count() })
      .from(articles)
      .innerJoin(articleMetadata, metadataJoinCondition(userId))
      .where(whereCondition);
    const data = await db
      .select({
        id: articles.id,
        title: articles.title,
        author: articles.author,
        source: articles.source,
        originalUrl: articles.originalUrl,
        publishTime: articles.publishTime,
        metadataId: articleMetadata.id,
        favoritedAt: articleMetadata.favoritedAt,
        archivedAt: articleMetadata.archivedAt,
        coverImage: articleMetadata.coverImage,
        summary: articles.summary,
        tags: articles.tags,
        readStatus: articles.readStatus,
        createdAt: articles.createdAt,
        isFavorited: articleMetadata.isFavorited,
        isArchived: articleMetadata.isArchived,
        isPublished: articleMetadata.isPublished,
        publishedAt: articleMetadata.publishedAt,
        publicId: articleMetadata.publicId,
        aiSummary: articleMetadata.aiSummary,
        aiCategory: articleMetadata.aiCategory,
        aiTags: articleMetadata.aiTags,
      })
      .from(articles)
      .innerJoin(articleMetadata, metadataJoinCondition(userId))
      .where(whereCondition)
      .orderBy(getArticleOrderBy(sort, order, hasActionTimestamps), desc(articles.id))
      .limit(perPage)
      .offset((page - 1) * perPage);

    return c.json({
      articles: data.map((article) => ({
        ...article,
        publicUrl: article.publicId ? `/p/${article.publicId}` : null,
        isFavorited: article.isFavorited ?? false,
        isArchived: article.isArchived ?? false,
        isPublished: true,
        aiTags: article.aiTags ?? [],
      })),
      total,
      page,
      perPage,
      sort,
      order,
      totalPages: Math.ceil(total / perPage),
    });
  }

  if (view === 'published') {
    const whereCondition = and(eq(articleMetadata.isPublished, true), sql`${articleMetadata.publicId} IS NOT NULL`);
    const [{ total }] = await db
      .select({ total: count() })
      .from(articleMetadata)
      .where(whereCondition);
    const data = await db
      .select({
        id: articles.id,
        title: articles.title,
        author: articles.author,
        source: articles.source,
        originalUrl: articles.originalUrl,
        publishTime: articles.publishTime,
        coverImage: articleMetadata.coverImage,
        contentMd: articleMetadata.contentMd,
        contentHtml: articleMetadata.contentHtml,
        aiSummary: articleMetadata.aiSummary,
        aiCategory: articleMetadata.aiCategory,
        aiTags: articleMetadata.aiTags,
        publishedAt: articleMetadata.publishedAt,
        publicId: articleMetadata.publicId,
      })
      .from(articleMetadata)
      .innerJoin(articles, eq(articles.id, articleMetadata.articleId))
      .where(whereCondition)
      .orderBy(desc(articleMetadata.publishedAt), desc(articles.id))
      .limit(perPage)
      .offset((page - 1) * perPage);

    return c.json({
      articles: data.map(serializePublicPublication),
      total,
      page,
      perPage,
      sort,
      order,
      totalPages: Math.ceil(total / perPage),
    });
  }

  if (!isAuthenticated(c)) {
    return c.json({ error: { code: 'FORBIDDEN', message: '请登录后访问' } }, 403);
  }

  const userId = getCurrentUser(c).id as number;
  let whereCondition = getViewCondition(view);
  if (category && category !== 'all' && view === 'archive') {
    whereCondition = and(whereCondition, eq(articles.source, category));
  }

  const baseQuery = db
    .select({
      id: articles.id,
      title: articles.title,
      author: articles.author,
      source: articles.source,
      originalUrl: articles.originalUrl,
      publishTime: articles.publishTime,
      metadataId: articleMetadata.id,
      favoritedAt: articleMetadata.favoritedAt,
      archivedAt: articleMetadata.archivedAt,
      coverImage: articleMetadata.coverImage,
      summary: articles.summary,
      tags: articles.tags,
      readStatus: articles.readStatus,
      createdAt: articles.createdAt,
      isFavorited: articleMetadata.isFavorited,
      isArchived: articleMetadata.isArchived,
      isPublished: articleMetadata.isPublished,
      publishedAt: articleMetadata.publishedAt,
      publicId: articleMetadata.publicId,
      aiSummary: articleMetadata.aiSummary,
      aiCategory: articleMetadata.aiCategory,
      aiTags: articleMetadata.aiTags,
    })
    .from(articles)
    .innerJoin(articleMetadata, metadataJoinCondition(userId));

  const [{ total }] = await db
    .select({ total: count() })
    .from(articles)
    .innerJoin(articleMetadata, metadataJoinCondition(userId))
    .where(whereCondition);
  const data = await baseQuery
    .where(whereCondition)
    .orderBy(getArticleOrderBy(sort, order, hasActionTimestamps), desc(articles.id))
    .limit(perPage)
    .offset((page - 1) * perPage);
  // 异步修复缺失的显示字段，不阻塞当前列表响应；下次请求即为修复后的数据
  repairMissingDisplayMeta(data, userId).catch((error) =>
    console.error('Background display meta repair failed:', error.message)
  );

  return c.json({
    articles: data.map((article) => ({
      ...article,
      publicUrl: article.isPublished && article.publicId ? `/p/${article.publicId}` : null,
      isFavorited: article.isFavorited ?? false,
      isArchived: article.isArchived ?? false,
      isPublished: article.isPublished ?? false,
      aiTags: article.aiTags ?? [],
    })),
    total,
    page,
    perPage,
    sort,
    order,
    totalPages: Math.ceil(total / perPage),
  });
});

/**
 * GET /publications/:publicId — 游客可读的公开文章详情
 */
articlesRoutes.get('/publications/:publicId', optionalAuth, async (c) => {
  const publicId = c.req.param('publicId');
  if (!publicId) return c.json({ error: { code: 'BAD_REQUEST', message: 'Missing public id' } }, 400);

  const publication = await getPublicPublicationRecord(publicId);
  if (!publication) return c.json({ error: { code: 'NOT_FOUND', message: 'Publication not found' } }, 404);
  return c.json({ article: serializePublicPublication(publication) });
});

/**
 * GET /articles/:id/meta — 单篇文章轻量信息
 * 不等待正文抓取，用于详情加载/失败时仍然展示原文入口
 */
articlesRoutes.get('/articles/:id/meta', optionalAuth, async (c) => {
  const idParam = c.req.param('id');
  if (!idParam) return c.json({ error: { code: 'BAD_REQUEST', message: 'Missing id' } }, 400);
  if (!isAuthenticated(c)) return c.json({ error: { code: 'FORBIDDEN', message: '请登录后访问' } }, 403);

  const article = await getArticleRecord(parseInt(idParam), getCurrentUser(c).id as number);
  if (!article) return c.json({ error: { code: 'NOT_FOUND', message: 'Article not found' } }, 404);
  return c.json(serializeArticleRecord(article));
});

/**
 * GET /articles/:id — 用户私有文章详情
 */
articlesRoutes.get('/articles/:id', optionalAuth, async (c) => {
  const idParam = c.req.param('id');
  if (!idParam) return c.json({ error: { code: 'BAD_REQUEST', message: 'Missing id' } }, 400);
  if (!isAuthenticated(c)) return c.json({ error: { code: 'FORBIDDEN', message: '请登录后访问' } }, 403);

  const id = parseInt(idParam);
  const userId = getCurrentUser(c).id as number;
  const format = c.req.query('format') || 'markdown';
  const htmlVariant = c.req.query('htmlVariant') === 'mobile' ? 'mobile' : 'desktop';
  let article = await getArticleRecord(id, userId);
  if (!article) return c.json({ error: { code: 'NOT_FOUND', message: 'Article not found' } }, 404);

  if (!article.title || !article.source || !article.publishTime) {
    // 异步修复，不阻塞当前详情响应；下次请求即为修复后的数据
    repairArticleDisplayMeta(id, userId).catch((error) =>
      console.error('Background display meta repair failed:', error.message)
    );
  }

  if (!article.metadataCoverImage) {
    processCoverImage(id, userId).catch((error) => console.error('Cover image process failed:', error.message));
  }

  const content = await getArticleContent(id, format as 'markdown' | 'html', htmlVariant, userId).catch((error) => {
    console.error('Fetch content failed:', error.message);
    return null;
  });

  return c.json({
    ...serializeArticleRecord(article),
    contentMd: format === 'markdown' ? content : null,
    contentHtml: format === 'html' ? content : null,
  });
});

/**
 * POST /articles/:id/favorite — 切换收藏状态
 * 需要登录
 */
articlesRoutes.post('/articles/:id/favorite', requireAuth, async (c) => {
  const idParam = c.req.param('id');
  if (!idParam) return c.json({ error: { code: 'BAD_REQUEST', message: 'Missing id' } }, 400);
  const id = parseInt(idParam);

  // 验证文章存在
  const [article] = await db.select().from(articles).where(eq(articles.id, id));
  if (!article) return c.json({ error: { code: 'NOT_FOUND', message: 'Article not found' } }, 404);

  const userId = getCurrentUser(c).id;
  const meta = await ensureMetadata(userId, id);
  const newState = !meta.isFavorited;
  const now = new Date();
  const hasActionTimestamps = await hasMetadataTimestampColumns();
  const updateValues = hasActionTimestamps
    ? { isFavorited: newState, favoritedAt: newState ? now : null, updatedAt: now }
    : { isFavorited: newState, updatedAt: now };

  await db
    .update(articleMetadata)
    .set(updateValues)
    .where(metadataWhereCondition(id, userId));

  return c.json({ articleId: id, isFavorited: newState });
});

/**
 * POST /articles/:id/archive — 归档（触发 AI 分类）
 * 需要登录
 */
articlesRoutes.post('/articles/:id/archive', requireAuth, async (c) => {
  const idParam = c.req.param('id');
  if (!idParam) return c.json({ error: { code: 'BAD_REQUEST', message: 'Missing id' } }, 400);
  const id = parseInt(idParam);

  const [article] = await db.select().from(articles).where(eq(articles.id, id));
  if (!article) return c.json({ error: { code: 'NOT_FOUND', message: 'Article not found' } }, 404);

  const userId = getCurrentUser(c).id;
  await ensureMetadata(userId, id);
  const now = new Date();
  const hasActionTimestamps = await hasMetadataTimestampColumns();
  const updateValues = hasActionTimestamps
    ? { isArchived: true, archivedAt: now, updatedAt: now }
    : { isArchived: true, updatedAt: now };

  await db
    .update(articleMetadata)
    .set(updateValues)
    .where(metadataWhereCondition(id, userId));

  // 异步触发 AI 摘要和标签生成、封面图处理
  generateSummaryAndTags(id, userId).catch((e) => console.error('AI summary/tags failed:', e.message));
  processCoverImage(id, userId).catch((e) => console.error('Cover image process failed:', e.message));
  enqueueArticleForWiki(id, userId).then(() => processWikiJobs(3)).catch((e) => console.error('Wiki enqueue failed:', e.message));

  return c.json({ articleId: id, isArchived: true });
});

/**
 * POST /articles/:id/unarchive — 取消归档
 * 需要登录
 */
articlesRoutes.post('/articles/:id/unarchive', requireAuth, async (c) => {
  const idParam = c.req.param('id');
  if (!idParam) return c.json({ error: { code: 'BAD_REQUEST', message: 'Missing id' } }, 400);
  const id = parseInt(idParam);

  const userId = getCurrentUser(c).id;
  await ensureMetadata(userId, id);
  const now = new Date();
  const hasActionTimestamps = await hasMetadataTimestampColumns();
  const updateValues = hasActionTimestamps
    ? { isArchived: false, archivedAt: null, updatedAt: now }
    : { isArchived: false, updatedAt: now };

  await db
    .update(articleMetadata)
    .set(updateValues)
    .where(metadataWhereCondition(id, userId));

  removeArticleFromWiki(id, userId).then(() => processWikiJobs(3)).catch((e) => console.error('Wiki remove failed:', e.message));

  return c.json({ articleId: id, isArchived: false });
});

/**
 * POST /articles/:id/publish — 发布文章（游客可见）
 * 如果未归档则自动归档（触发摘要生成），再标记为已发布
 */
articlesRoutes.post('/articles/:id/publish', requireAuth, async (c) => {
  const idParam = c.req.param('id');
  if (!idParam) return c.json({ error: { code: 'BAD_REQUEST', message: 'Missing id' } }, 400);
  const id = parseInt(idParam);
  const userId = getCurrentUser(c).id as number;
  const existingMetadata = await getArticleRecord(id, userId);
  if (!existingMetadata) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Article not found in your library' } }, 404);
  }

  if (existingMetadata.isPublished && existingMetadata.publicId) {
    return c.json({
      article: serializeArticleRecord(existingMetadata),
      publicUrl: `/p/${existingMetadata.publicId}`,
    });
  }

  const now = new Date();
  if (!existingMetadata.isArchived) {
    const content = await getArticleContent(id, 'markdown', 'desktop', userId);
    if (!content) {
      return c.json({ error: { code: 'PUBLICATION_NOT_READY', message: '文章正文尚未准备完成，无法发布' } }, 422);
    }

    await db.update(articleMetadata)
      .set({ isArchived: true, archivedAt: now, updatedAt: now })
      .where(metadataWhereCondition(id, userId));
    await processCoverImage(id, userId).catch((error) => console.error('Cover image process failed:', error.message));
  }

  let readyMetadata = await getArticleRecord(id, userId);
  if (!readyMetadata) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Article not found in your library' } }, 404);
  }

  if (!readyMetadata.aiSummary || !(readyMetadata.aiTags?.length)) {
    await generateSummaryAndTags(id, userId);
    readyMetadata = await getArticleRecord(id, userId);
  }

  if (!readyMetadata?.aiSummary || !(readyMetadata.aiTags?.length)) {
    return c.json({ error: { code: 'PUBLICATION_NOT_READY', message: 'AI 摘要和标签尚未准备完成，无法发布' } }, 422);
  }

  await db.update(articleMetadata)
    .set({
      isArchived: true,
      archivedAt: readyMetadata.archivedAt || now,
      isPublished: true,
      publishedAt: now,
      publicId: existingMetadata.publicId || randomUUID(),
      updatedAt: now,
    })
    .where(metadataWhereCondition(id, userId));

  const published = await getArticleRecord(id, userId);
  if (!published?.publicId) {
    return c.json({ error: { code: 'PUBLICATION_NOT_READY', message: '公开链接生成失败' } }, 500);
  }

  enqueueArticleForWiki(id, userId).then(() => processWikiJobs(3)).catch((error) => console.error('Wiki enqueue failed:', error.message));
  return c.json({
    article: serializeArticleRecord(published),
    publicUrl: `/p/${published.publicId}`,
  });
});

/**
 * POST /articles/:id/unpublish — 取消发布，保留用户归档和公开 Token
 */
articlesRoutes.post('/articles/:id/unpublish', requireAuth, async (c) => {
  const idParam = c.req.param('id');
  if (!idParam) return c.json({ error: { code: 'BAD_REQUEST', message: 'Missing id' } }, 400);
  const id = parseInt(idParam);
  const userId = getCurrentUser(c).id as number;
  const existingMetadata = await getArticleRecord(id, userId);
  if (!existingMetadata) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Article not found in your library' } }, 404);
  }

  await db.update(articleMetadata)
    .set({ isPublished: false, updatedAt: new Date() })
    .where(metadataWhereCondition(id, userId));

  const article = await getArticleRecord(id, userId);
  return c.json({
    article: article ? serializeArticleRecord(article) : null,
    publicUrl: null,
  });
});

/**
 * POST /articles/:id/refetch — 重新抓取正文和封面图
 * 需要登录
 */
articlesRoutes.post('/articles/:id/refetch', requireAuth, async (c) => {
  const idParam = c.req.param('id');
  if (!idParam) return c.json({ error: { code: 'BAD_REQUEST', message: 'Missing id' } }, 400);
  const id = parseInt(idParam);

  const [article] = await db.select().from(articles).where(eq(articles.id, id));
  if (!article) return c.json({ error: { code: 'NOT_FOUND', message: 'Article not found' } }, 404);

  const userId = getCurrentUser(c).id;
  await ensureMetadata(userId, id);
  await ensureArticleMetadataContentHtmlMobileColumn();
  await db.update(articleMetadata)
    .set({ contentMd: null, contentHtml: null, contentHtmlMobile: null, coverImage: null, updatedAt: new Date() })
    .where(metadataWhereCondition(id, userId));

  const [contentHtml, contentHtmlMobile, contentMd, coverImage] = await Promise.all([
    getArticleContent(id, 'html', 'desktop', userId),
    getArticleContent(id, 'html', 'mobile', userId),
    getArticleContent(id, 'markdown', 'desktop', userId),
    processCoverImage(id, userId),
  ]);
  const hasCapturedContent = Boolean(contentHtml || contentHtmlMobile || contentMd);

  if (!hasCapturedContent) {
    return c.json({
      error: {
        code: 'BODY_CAPTURE_FAILED',
        message: '正文抓取失败：所有可用抓取方式均未返回有效正文',
      },
    }, 422);
  }

  return c.json({
    articleId: id,
    contentHtml: Boolean(contentHtml),
    contentHtmlMobile: Boolean(contentHtmlMobile),
    contentMd: Boolean(contentMd),
    coverImage,
  });
});

/**
 * POST /articles/:id/regenerate-ai — 重新生成 AI 摘要和标签
 * 需要登录
 */
articlesRoutes.post('/articles/:id/regenerate-ai', requireAuth, async (c) => {
  const idParam = c.req.param('id');
  if (!idParam) return c.json({ error: { code: 'BAD_REQUEST', message: 'Missing id' } }, 400);
  const id = parseInt(idParam);

  const [article] = await db.select().from(articles).where(eq(articles.id, id));
  if (!article) return c.json({ error: { code: 'NOT_FOUND', message: 'Article not found' } }, 404);

  const userId = getCurrentUser(c).id;
  await ensureMetadata(userId, id);
  await db.update(articleMetadata)
    .set({ aiSummary: null, aiTags: [], updatedAt: new Date() })
    .where(metadataWhereCondition(id, userId));

  await generateSummaryAndTags(id, userId);
  return c.json({ articleId: id, ok: true });
});

/**
 * DELETE /articles/:id — 删除平台元数据，保留原始文章
 * 需要登录
 */
articlesRoutes.delete('/articles/:id', requireAuth, async (c) => {
  const idParam = c.req.param('id');
  if (!idParam) return c.json({ error: { code: 'BAD_REQUEST', message: 'Missing id' } }, 400);
  const id = parseInt(idParam);

  const [article] = await db.select({ id: articles.id }).from(articles).where(eq(articles.id, id));
  if (!article) return c.json({ error: { code: 'NOT_FOUND', message: 'Article not found' } }, 404);

  const userId = getCurrentUser(c).id;
  await removeArticleFromWiki(id, userId).catch((e) => console.error('Wiki remove failed:', e.message));
  await db.delete(articleMetadata).where(metadataWhereCondition(id, userId));

  return c.json({ articleId: id, deleted: true, scope: 'metadata', visibleInInbox: true });
});

/**
 * DELETE /articles/:id/permanent — 永久删除平台元数据和原始文章
 * 需要登录
 */
articlesRoutes.delete('/articles/:id/permanent', requireAuth, async (c) => {
  const idParam = c.req.param('id');
  if (!idParam) return c.json({ error: { code: 'BAD_REQUEST', message: 'Missing id' } }, 400);
  const id = parseInt(idParam);

  const [article] = await db.select({ id: articles.id }).from(articles).where(eq(articles.id, id));
  if (!article) return c.json({ error: { code: 'NOT_FOUND', message: 'Article not found' } }, 404);

  const userId = getCurrentUser(c).id;
  await removeArticleFromWiki(id, userId).catch((e) => console.error('Wiki remove failed:', e.message));
  await db.delete(articleMetadata).where(metadataWhereCondition(id, userId));
  const [{ remaining }] = await db
    .select({ remaining: count() })
    .from(articleMetadata)
    .where(eq(articleMetadata.articleId, id));
  if (Number(remaining) === 0) {
    await db.delete(articles).where(eq(articles.id, id));
  }

  return c.json({ articleId: id, deleted: true, scope: Number(remaining) === 0 ? 'permanent' : 'metadata' });
});

/**
 * GET /counts — 获取各视图的文章计数（合并请求，减少 API 调用）
 */
articlesRoutes.get('/counts', optionalAuth, async (c) => {
  // 游客获取 published 计数
  if (!isAuthenticated(c)) {
    const result = await db.execute(sql`
      SELECT COUNT(*) as published
      FROM article_metadata m
      WHERE m.is_published = true
    `);
    return c.json({ inbox: 0, favorites: 0, archive: 0, published: Number(result.rows[0]?.published || 0), wiki: 0 });
  }

  // 登录用户获取所有计数（使用单个 SQL 查询）
  const userId = getCurrentUser(c).id as number;
  const result = await db.execute(sql`
    SELECT
      (SELECT COUNT(*) FROM article_metadata m
       WHERE m.user_id = ${userId}
         AND m.is_archived = false
         AND m.is_favorited = false) as inbox,
      (SELECT COUNT(*) FROM article_metadata m
       WHERE m.user_id = ${userId}
         AND m.is_favorited = true) as favorites,
      (SELECT COUNT(*) FROM article_metadata m
       WHERE m.user_id = ${userId}
         AND m.is_archived = true) as archive,
      (SELECT COUNT(*) FROM article_metadata m
       WHERE m.user_id = ${userId}
         AND m.is_published = true) as published,
      (SELECT COUNT(*) FROM wiki_pages WHERE status = 'active') as wiki
  `);

  const row = result.rows[0];
  return c.json({
    inbox: Number(row?.inbox || 0),
    favorites: Number(row?.favorites || 0),
    archive: Number(row?.archive || 0),
    published: Number(row?.published || 0),
    wiki: Number(row?.wiki || 0),
  });
});

/**
 * GET /sources — 公众号来源统计（归档页使用）
 */
articlesRoutes.get('/sources', optionalAuth, async (c) => {
  if (!isAuthenticated(c)) return c.json({ error: { code: 'FORBIDDEN', message: '请登录后访问' } }, 403);
  const userId = getCurrentUser(c).id as number;
  const sortParam = c.req.query('sort') || 'count';
  const orderParam = c.req.query('order') || 'desc';
  const validSorts = ['count', 'name', 'latest'];
  const sort = validSorts.includes(sortParam) ? sortParam : 'count';
  const order = orderParam === 'asc' || orderParam === 'desc' ? orderParam : 'desc';

  try {
    // 排序下推到 SQL ORDER BY，避免把全量分组结果拉到内存再排
    const orderByExpr =
      sort === 'name'
        ? (order === 'asc' ? asc(articles.source) : desc(articles.source))
        : sort === 'latest'
          ? (order === 'asc' ? asc(sql`MAX(${articles.createdAt})`) : desc(sql`MAX(${articles.createdAt})`))
          : (order === 'asc' ? asc(sql`count(*)`) : desc(sql`count(*)`));

    const rows = await db
      .select({
        source: articles.source,
        count: count(),
        latestCreatedAt: sql<Date>`MAX(${articles.createdAt})`,
      })
      .from(articles)
      .innerJoin(articleMetadata, metadataJoinCondition(userId))
      .where(and(
        eq(articleMetadata.isArchived, true),
        sql`${articles.source} IS NOT NULL`
      ))
      .groupBy(articles.source)
      .orderBy(orderByExpr);

    return c.json(rows.map((r: any) => ({
      source: r.source,
      count: r.count,
      latestCreatedAt: r.latestCreatedAt,
    })));
  } catch (e: any) {
    console.error('Failed to get sources:', e.message);
    return c.json({ error: { code: 'INTERNAL_ERROR', message: '获取来源统计失败' } }, 500);
  }
});

/**
 * GET /articles/:id/position — 查找文章在某个视图中的页码位置
 * 游客只能查询 archive 视图
 * 优化：使用子查询计算位置，避免查询所有文章
 */
articlesRoutes.get('/articles/:id/position', optionalAuth, async (c) => {
  const idParam = c.req.param('id');
  if (!idParam) return c.json({ error: { code: 'BAD_REQUEST', message: 'Missing id' } }, 400);
  const id = parseInt(idParam);
  const view = c.req.query('view') || 'inbox';
  const category = c.req.query('category');
  const perPageParam = c.req.query('perPage') || '18';
  const perPage = parseInt(perPageParam);

  if (!['inbox', 'favorites', 'archive'].includes(view)) {
    return c.json({ error: { code: 'BAD_REQUEST', message: 'Invalid view' } }, 400);
  }

  if (!isAuthenticated(c)) {
    return c.json({ error: { code: 'FORBIDDEN', message: '请登录后访问' } }, 403);
  }

  const userId = getCurrentUser(c).id as number;
  let whereCondition = getViewCondition(view);

  if (category && category !== 'all' && view === 'archive') {
    whereCondition = and(whereCondition, eq(articles.source, category));
  }

  const [targetArticle] = await db
    .select({
      id: articles.id,
      createdAt: articles.createdAt,
    })
    .from(articles)
    .innerJoin(articleMetadata, metadataJoinCondition(userId))
    .where(and(eq(articles.id, id), whereCondition))
    .limit(1);

  if (!targetArticle?.createdAt) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Article not found in this view' } }, 404);
  }

  const [{ position }] = await db
    .select({
      position: sql<number>`(COUNT(*)::int + 1)`,
    })
    .from(articles)
    .innerJoin(articleMetadata, metadataJoinCondition(userId))
    .where(and(
      whereCondition,
      or(
        gt(articles.createdAt, targetArticle.createdAt),
        and(eq(articles.createdAt, targetArticle.createdAt), gt(articles.id, id))
      )
    ));

  // 计算总数（用于 totalPages）
  const [{ total }] = await db
    .select({ total: count() })
    .from(articles)
    .innerJoin(articleMetadata, metadataJoinCondition(userId))
    .where(whereCondition);

  const page = Math.floor((position - 1) / perPage) + 1;

  return c.json({
    articleId: id,
    view,
    position,
    page,
    perPage,
    total,
    totalPages: Math.ceil(total / perPage),
  });
});
