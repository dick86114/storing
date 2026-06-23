import { Hono } from 'hono';
import { db } from '../db/index.js';
import { articles, articleMetadata } from '../db/schema.js';
import { eq, and, asc, desc, count, sql, or, isNull } from 'drizzle-orm';
import { generateSummaryAndTags } from '../services/ai.service.js';
import { getArticleContent, processCoverImage } from '../services/reader.service.js';
import { enqueueArticleForWiki, processWikiJobs, removeArticleFromWiki } from '../services/wiki.service.js';
import { requireAuth, optionalAuth, isAuthenticated } from '../middleware/auth.js';

export const articlesRoutes = new Hono();

type ArticleSortField = 'collected' | 'published' | 'favorited' | 'archived';
type SortOrder = 'asc' | 'desc';

async function hasMetadataTimestampColumns() {
  try {
    const result = await db.execute(sql`
      SELECT COUNT(*)::int AS count
      FROM information_schema.columns
      WHERE table_name = 'article_metadata'
        AND column_name IN ('favorited_at', 'archived_at')
    `);
    return Number(result.rows[0]?.count ?? 0) === 2;
  } catch {
    return false;
  }
}

function getDefaultArticleSort(view: string): ArticleSortField {
  if (view === 'favorites') return 'favorited';
  if (view === 'archive') return 'archived';
  return 'collected';
}

function normalizeArticleSort(view: string, sort?: string): ArticleSortField {
  const defaultSort = getDefaultArticleSort(view);
  const allowedByView: Record<string, ArticleSortField[]> = {
    inbox: ['collected', 'published'],
    favorites: ['favorited', 'collected', 'published'],
    archive: ['archived', 'collected', 'published'],
  };
  const allowed = allowedByView[view] ?? allowedByView.inbox;
  return allowed.includes(sort as ArticleSortField) ? (sort as ArticleSortField) : defaultSort;
}

function normalizeSortOrder(order?: string): SortOrder {
  return order === 'asc' ? 'asc' : 'desc';
}

function getArticleSortExpression(sort: ArticleSortField, hasActionTimestamps: boolean) {
  if (sort === 'published') return articles.publishTime;
  if (sort === 'favorited' && hasActionTimestamps) return sql`coalesce(${articleMetadata.favoritedAt}, ${articles.createdAt})`;
  if (sort === 'archived' && hasActionTimestamps) return sql`coalesce(${articleMetadata.archivedAt}, ${articles.createdAt})`;
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
async function ensureMetadata(articleId: number) {
  const [existing] = await db
    .select({
      id: articleMetadata.id,
      articleId: articleMetadata.articleId,
      isFavorited: articleMetadata.isFavorited,
      isArchived: articleMetadata.isArchived,
    })
    .from(articleMetadata)
    .where(eq(articleMetadata.articleId, articleId));

  if (existing) return existing;

  await db
    .insert(articleMetadata)
    .values({ articleId });

  return {
    articleId,
    isFavorited: false,
    isArchived: false,
  };
}

async function getArticleRecord(id: number) {
  const [article] = await db
    .select({
      id: articles.id,
      title: articles.title,
      author: articles.author,
      source: articles.source,
      originalUrl: articles.originalUrl,
      publishTime: articles.publishTime,
      articleCoverImage: articles.coverImage,
      metadataCoverImage: articleMetadata.coverImage,
      summary: articles.summary,
      commentary: articles.commentary,
      tags: articles.tags,
      readStatus: articles.readStatus,
      createdAt: articles.createdAt,
      isFavorited: articleMetadata.isFavorited,
      isArchived: articleMetadata.isArchived,
      aiSummary: articleMetadata.aiSummary,
      aiCategory: articleMetadata.aiCategory,
      aiTags: articleMetadata.aiTags,
    })
    .from(articles)
    .leftJoin(articleMetadata, eq(articles.id, articleMetadata.articleId))
    .where(eq(articles.id, id));

  return article ?? null;
}

function serializeArticleRecord(article: NonNullable<Awaited<ReturnType<typeof getArticleRecord>>>) {
  const { articleCoverImage, metadataCoverImage, ...rest } = article;

  return {
    ...rest,
    coverImage: metadataCoverImage || articleCoverImage,
    isFavorited: article.isFavorited ?? false,
    isArchived: article.isArchived ?? false,
    aiTags: article.aiTags ?? [],
  };
}

/**
 * GET /articles — 文章列表
 * 游客只能访问 archive 视图
 */
articlesRoutes.get('/articles', optionalAuth, async (c) => {
  const view = c.req.query('view') || 'inbox';
  const category = c.req.query('category');
  const page = parseInt(c.req.query('page') || '1');
  const perPage = parseInt(c.req.query('perPage') || '8');
  const sort = normalizeArticleSort(view, c.req.query('sort'));
  const order = normalizeSortOrder(c.req.query('order'));
  const hasActionTimestamps = await hasMetadataTimestampColumns();

  // 游客只能访问 archive 视图
  if (!isAuthenticated(c) && view !== 'archive') {
    return c.json({ error: { code: 'FORBIDDEN', message: '请登录后访问' } }, 403);
  }

  // 构建查询：LEFT JOIN article_metadata
  let whereCondition;

  if (view === 'inbox') {
    // 收件箱：未归档且未收藏的文章（包括没有 metadata 的）
    whereCondition = or(
      isNull(articleMetadata.id),
      and(
        eq(articleMetadata.isArchived, false),
        eq(articleMetadata.isFavorited, false)
      )
    );
  } else if (view === 'favorites') {
    whereCondition = eq(articleMetadata.isFavorited, true);
  } else if (view === 'archive') {
    whereCondition = eq(articleMetadata.isArchived, true);
  }

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
      coverImage: articleMetadata.coverImage,
      summary: articles.summary,
      tags: articles.tags,
      readStatus: articles.readStatus,
      createdAt: articles.createdAt,
      // metadata fields (nullable)
      isFavorited: articleMetadata.isFavorited,
      isArchived: articleMetadata.isArchived,
      aiSummary: articleMetadata.aiSummary,
      aiCategory: articleMetadata.aiCategory,
      aiTags: articleMetadata.aiTags,
    })
    .from(articles)
    .leftJoin(articleMetadata, eq(articles.id, articleMetadata.articleId));

  const [{ total }] = await db
    .select({ total: count() })
    .from(articles)
    .leftJoin(articleMetadata, eq(articles.id, articleMetadata.articleId))
    .where(whereCondition);

  const data = await baseQuery
    .where(whereCondition)
    .orderBy(getArticleOrderBy(sort, order, hasActionTimestamps), desc(articles.id))
    .limit(perPage)
    .offset((page - 1) * perPage);

  return c.json({
    articles: data.map(a => ({
      ...a,
      isFavorited: a.isFavorited ?? false,
      isArchived: a.isArchived ?? false,
      aiTags: a.aiTags ?? [],
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
 * GET /articles/:id/meta — 单篇文章轻量信息
 * 不等待正文抓取，用于详情加载/失败时仍然展示原文入口
 */
articlesRoutes.get('/articles/:id/meta', optionalAuth, async (c) => {
  const idParam = c.req.param('id');
  if (!idParam) return c.json({ error: { code: 'BAD_REQUEST', message: 'Missing id' } }, 400);
  const id = parseInt(idParam);

  const article = await getArticleRecord(id);
  if (!article) return c.json({ error: { code: 'NOT_FOUND', message: 'Article not found' } }, 404);

  if (!isAuthenticated(c) && !article.isArchived) {
    return c.json({ error: { code: 'FORBIDDEN', message: '请登录后访问' } }, 403);
  }

  return c.json(serializeArticleRecord(article));
});

/**
 * GET /articles/:id — 单篇文章详情
 * 游客只能查看归档文章
 */
articlesRoutes.get('/articles/:id', optionalAuth, async (c) => {
  const idParam = c.req.param('id');
  if (!idParam) return c.json({ error: { code: 'BAD_REQUEST', message: 'Missing id' } }, 400);
  const id = parseInt(idParam);
  const format = c.req.query('format') || 'markdown';

  const article = await getArticleRecord(id);

  if (!article) return c.json({ error: { code: 'NOT_FOUND', message: 'Article not found' } }, 404);

  // 游客只能查看归档文章
  if (!isAuthenticated(c) && !article.isArchived) {
    return c.json({ error: { code: 'FORBIDDEN', message: '请登录后访问' } }, 403);
  }

  // 登录用户首次访问时，异步处理封面图（如果 metadata 尚无封面图）
  if (isAuthenticated(c) && !article.metadataCoverImage) {
    processCoverImage(id).catch((e) => console.error('Cover image process failed:', e.message));
  }

  // 获取正文内容（根据 format 参数）
  const content = await getArticleContent(id, format as 'markdown' | 'html').catch((e) => {
    console.error('Fetch content failed:', e.message);
    return null;
  });

  const serializedArticle = serializeArticleRecord(article);

  return c.json({
    ...serializedArticle,
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

  const meta = await ensureMetadata(id);
  const newState = !meta.isFavorited;
  const now = new Date();
  const hasActionTimestamps = await hasMetadataTimestampColumns();
  const updateValues = hasActionTimestamps
    ? { isFavorited: newState, favoritedAt: newState ? now : null, updatedAt: now }
    : { isFavorited: newState, updatedAt: now };

  await db
    .update(articleMetadata)
    .set(updateValues)
    .where(eq(articleMetadata.articleId, id));

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

  await ensureMetadata(id);
  const now = new Date();
  const hasActionTimestamps = await hasMetadataTimestampColumns();
  const updateValues = hasActionTimestamps
    ? { isArchived: true, archivedAt: now, updatedAt: now }
    : { isArchived: true, updatedAt: now };

  await db
    .update(articleMetadata)
    .set(updateValues)
    .where(eq(articleMetadata.articleId, id));

  // 异步触发 AI 摘要和标签生成、封面图处理
  generateSummaryAndTags(id).catch((e) => console.error('AI summary/tags failed:', e.message));
  processCoverImage(id).catch((e) => console.error('Cover image process failed:', e.message));
  enqueueArticleForWiki(id).then(() => processWikiJobs(3)).catch((e) => console.error('Wiki enqueue failed:', e.message));

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

  await ensureMetadata(id);
  const now = new Date();
  const hasActionTimestamps = await hasMetadataTimestampColumns();
  const updateValues = hasActionTimestamps
    ? { isArchived: false, archivedAt: null, updatedAt: now }
    : { isArchived: false, updatedAt: now };

  await db
    .update(articleMetadata)
    .set(updateValues)
    .where(eq(articleMetadata.articleId, id));

  removeArticleFromWiki(id).then(() => processWikiJobs(3)).catch((e) => console.error('Wiki remove failed:', e.message));

  return c.json({ articleId: id, isArchived: false });
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

  await ensureMetadata(id);
  await db.update(articleMetadata)
    .set({ contentMd: null, contentHtml: null, coverImage: null, updatedAt: new Date() })
    .where(eq(articleMetadata.articleId, id));

  const [contentHtml, contentMd, coverImage] = await Promise.all([
    getArticleContent(id, 'html'),
    getArticleContent(id, 'markdown'),
    processCoverImage(id),
  ]);

  return c.json({
    articleId: id,
    contentHtml: Boolean(contentHtml),
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

  await ensureMetadata(id);
  await db.update(articleMetadata)
    .set({ aiSummary: null, aiTags: [], updatedAt: new Date() })
    .where(eq(articleMetadata.articleId, id));

  await generateSummaryAndTags(id);
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

  await removeArticleFromWiki(id).catch((e) => console.error('Wiki remove failed:', e.message));
  await db.delete(articleMetadata).where(eq(articleMetadata.articleId, id));

  return c.json({ articleId: id, deleted: true, scope: 'metadata' });
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

  await removeArticleFromWiki(id).catch((e) => console.error('Wiki remove failed:', e.message));
  await db.delete(articleMetadata).where(eq(articleMetadata.articleId, id));
  await db.delete(articles).where(eq(articles.id, id));

  return c.json({ articleId: id, deleted: true, scope: 'permanent' });
});

/**
 * GET /counts — 获取各视图的文章计数（合并请求，减少 API 调用）
 */
articlesRoutes.get('/counts', optionalAuth, async (c) => {
  // 游客只能获取 archive 计数
  if (!isAuthenticated(c)) {
    const result = await db.execute(sql`
      SELECT COUNT(*) as archive FROM articles a
      LEFT JOIN article_metadata m ON a.id = m.article_id
      WHERE m.is_archived = true
    `);
    return c.json({ inbox: 0, favorites: 0, archive: Number(result.rows[0]?.archive || 0), wiki: 0 });
  }

  // 登录用户获取所有计数（使用单个 SQL 查询）
  const result = await db.execute(sql`
    SELECT
      (SELECT COUNT(*) FROM articles a
       LEFT JOIN article_metadata m ON a.id = m.article_id
       WHERE m.id IS NULL OR (m.is_archived = false AND m.is_favorited = false)) as inbox,
      (SELECT COUNT(*) FROM articles a
       LEFT JOIN article_metadata m ON a.id = m.article_id
       WHERE m.is_favorited = true) as favorites,
      (SELECT COUNT(*) FROM articles a
       LEFT JOIN article_metadata m ON a.id = m.article_id
       WHERE m.is_archived = true) as archive,
      (SELECT COUNT(*) FROM wiki_pages WHERE status = 'active') as wiki
  `);

  const row = result.rows[0];
  return c.json({
    inbox: Number(row?.inbox || 0),
    favorites: Number(row?.favorites || 0),
    archive: Number(row?.archive || 0),
    wiki: Number(row?.wiki || 0),
  });
});

/**
 * GET /sources — 公众号来源统计（归档页使用）
 */
articlesRoutes.get('/sources', async (c) => {
  const sortParam = c.req.query('sort') || 'count';
  const orderParam = c.req.query('order') || 'desc';
  const validSorts = ['count', 'name', 'latest'];
  const sort = validSorts.includes(sortParam) ? sortParam : 'count';
  const order = orderParam === 'asc' || orderParam === 'desc' ? orderParam : 'desc';

  try {
    const rows = await db
      .select({
        source: articles.source,
        count: count(),
        latestCreatedAt: sql<Date>`MAX(${articles.createdAt})`,
      })
      .from(articles)
      .innerJoin(articleMetadata, eq(articles.id, articleMetadata.articleId))
      .where(and(
        eq(articleMetadata.isArchived, true),
        sql`${articles.source} IS NOT NULL`
      ))
      .groupBy(articles.source);

    const sortedRows = rows.sort((a: any, b: any) => {
      let comparison = 0;
      if (sort === 'name') {
        comparison = (a.source || '').localeCompare(b.source || '');
      } else if (sort === 'latest') {
        const dateA = a.latestCreatedAt ? new Date(a.latestCreatedAt).getTime() : 0;
        const dateB = b.latestCreatedAt ? new Date(b.latestCreatedAt).getTime() : 0;
        comparison = dateB - dateA;
      } else {
        comparison = (b.count || 0) - (a.count || 0);
      }
      return order === 'asc' ? -comparison : comparison;
    });

    return c.json(sortedRows.map((r: any) => ({
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

  // 游客只能查询 archive 视图
  if (!isAuthenticated(c) && view !== 'archive') {
    return c.json({ error: { code: 'FORBIDDEN', message: '请登录后访问' } }, 403);
  }

  let whereCondition;

  if (view === 'inbox') {
    whereCondition = or(
      isNull(articleMetadata.id),
      and(
        eq(articleMetadata.isArchived, false),
        eq(articleMetadata.isFavorited, false)
      )
    );
  } else if (view === 'favorites') {
    whereCondition = eq(articleMetadata.isFavorited, true);
  } else if (view === 'archive') {
    whereCondition = eq(articleMetadata.isArchived, true);
  }

  if (category && category !== 'all' && view === 'archive') {
    whereCondition = and(whereCondition, eq(articles.source, category));
  }

  // 使用子查询计算位置（比查询所有文章更高效）
  const [{ position }] = await db
    .select({
      position: sql<number>`
        SELECT COUNT(*) + 1
        FROM articles a
        LEFT JOIN article_metadata m ON a.id = m.article_id
        WHERE a.created_at > (SELECT created_at FROM articles WHERE id = ${id})
        AND (${sql.raw(view === 'inbox' ? 'm.id IS NULL OR (m.is_archived = false AND m.is_favorited = false)' : view === 'favorites' ? 'm.is_favorited = true' : 'm.is_archived = true')})
        ${category && category !== 'all' && view === 'archive' ? sql.raw(`AND a.source = '${category}'`) : sql.raw('')}
      `.as('position')
    })
    .from(articles)
    .where(eq(articles.id, id))
    .limit(1);

  if (!position) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Article not found in this view' } }, 404);
  }

  // 计算总数（用于 totalPages）
  const [{ total }] = await db
    .select({ total: count() })
    .from(articles)
    .leftJoin(articleMetadata, eq(articles.id, articleMetadata.articleId))
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
