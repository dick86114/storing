import { Hono } from 'hono';
import { db } from '../db/index.js';
import { articles, articleMetadata } from '../db/schema.js';
import { eq, and, desc, count, sql, or, isNull } from 'drizzle-orm';
import { classifyAndTag, reclassifyArticle, reclassifyAllArticles } from '../services/ai.service.js';
import { getArticleContent, processCoverImage } from '../services/reader.service.js';
import { requireAuth, optionalAuth, isAuthenticated } from '../middleware/auth.js';

export const articlesRoutes = new Hono();


/**
 * 确保 article_metadata 记录存在，不存在则创建
 */
async function ensureMetadata(articleId: number) {
  const [existing] = await db
    .select()
    .from(articleMetadata)
    .where(eq(articleMetadata.articleId, articleId));

  if (existing) return existing;

  const [created] = await db
    .insert(articleMetadata)
    .values({ articleId })
    .returning();
  return created;
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
    whereCondition = and(whereCondition, eq(articleMetadata.aiCategory, category));
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
    .orderBy(desc(articles.createdAt))
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
    totalPages: Math.ceil(total / perPage),
  });
});

/**
 * GET /articles/:id — 单篇文章详情
 * 游客只能查看归档文章
 */
articlesRoutes.get('/articles/:id', optionalAuth, async (c) => {
  const idParam = c.req.param('id');
  if (!idParam) return c.json({ error: { code: 'BAD_REQUEST', message: 'Missing id' } }, 400);
  const id = parseInt(idParam);

  // 先查询 metadata 看是否已有图床封面图
  const [meta] = await db
    .select({ coverImage: articleMetadata.coverImage })
    .from(articleMetadata)
    .where(eq(articleMetadata.articleId, id));

  const [article] = await db
    .select({
      id: articles.id,
      title: articles.title,
      author: articles.author,
      source: articles.source,
      originalUrl: articles.originalUrl,
      publishTime: articles.publishTime,
      coverImage: articles.coverImage,
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

  if (!article) return c.json({ error: { code: 'NOT_FOUND', message: 'Article not found' } }, 404);

  // 游客只能查看归档文章
  if (!isAuthenticated(c) && !article.isArchived) {
    return c.json({ error: { code: 'FORBIDDEN', message: '请登录后访问' } }, 403);
  }

  // 登录用户首次访问时，异步处理封面图（如果 metadata 尚无封面图）
  if (isAuthenticated(c) && !meta?.coverImage) {
    processCoverImage(id).catch((e) => console.error('Cover image process failed:', e.message));
  }

  // 获取 markdown 正文（首次抓取并缓存，后续读库）
  const contentMd = await getArticleContent(id).catch((e) => {
    console.error('Fetch markdown failed:', e.message);
    return null;
  });

  // 封面图优先使用图床 URL（如果有）
  const finalCoverImage = meta?.coverImage || article.coverImage;

  return c.json({
    ...article,
    coverImage: finalCoverImage,
    contentMd,
    isFavorited: article.isFavorited ?? false,
    isArchived: article.isArchived ?? false,
    aiTags: article.aiTags ?? [],
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

  const [updated] = await db
    .update(articleMetadata)
    .set({ isFavorited: newState, updatedAt: new Date() })
    .where(eq(articleMetadata.articleId, id))
    .returning();

  return c.json({ ...updated, articleId: id });
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

  const [updated] = await db
    .update(articleMetadata)
    .set({ isArchived: true, updatedAt: new Date() })
    .where(eq(articleMetadata.articleId, id))
    .returning();

  // 异步触发 AI 分类和标签、封面图处理
  classifyAndTag(id).catch((e) => console.error('AI classify/tag failed:', e.message));
  processCoverImage(id).catch((e) => console.error('Cover image process failed:', e.message));

  return c.json({ ...updated, articleId: id });
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

  const [updated] = await db
    .update(articleMetadata)
    .set({ isArchived: false, updatedAt: new Date() })
    .where(eq(articleMetadata.articleId, id))
    .returning();

  return c.json({ ...updated, articleId: id });
});

/**
 * GET /sources — 公众号来源统计（归档页使用）
 */
articlesRoutes.get('/sources', async (c) => {
  const sortParam = c.req.query('sort') || 'count';
  const validSorts = ['count', 'name', 'latest'];
  const sort = validSorts.includes(sortParam) ? sortParam : 'count';

  try {
    let query = db
      .select({
        source: articles.source,
        count: count(),
        latestCreatedAt: sql<Date>`MAX(${articles.createdAt})`,
      })
      .from(articles)
      .innerJoin(articleMetadata, eq(articles.id, articleMetadata.articleId))
      .where(eq(articleMetadata.isArchived, true))
      .where(sql`${articles.source} IS NOT NULL`)
      .groupBy(articles.source);

    // 根据 sort 参数添加 ORDER BY
    if (sort === 'name') {
      query = query.orderBy(articles.source);
    } else if (sort === 'latest') {
      query = query.orderBy(sql`MAX(${articles.createdAt}) DESC`);
    } else {
      query = query.orderBy(sql`${count()} DESC`);
    }

    const rows = await query;

    return c.json(rows.map(r => ({
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
    whereCondition = and(whereCondition, eq(articleMetadata.aiCategory, category));
  }

  const allArticles = await db
    .select({ id: articles.id })
    .from(articles)
    .leftJoin(articleMetadata, eq(articles.id, articleMetadata.articleId))
    .where(whereCondition)
    .orderBy(desc(articles.createdAt));

  const position = allArticles.findIndex(a => a.id === id);
  
  if (position === -1) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Article not found in this view' } }, 404);
  }

  const page = Math.floor(position / perPage) + 1;

  return c.json({
    articleId: id,
    view,
    position: position + 1,
    page,
    perPage,
    total: allArticles.length,
    totalPages: Math.ceil(allArticles.length / perPage),
  });
});

// 全量重新分类（必须在 :id 路由之前注册）
articlesRoutes.post('/articles/reclassify-all', requireAuth, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const regenerateTags = body.regenerateTags === true;

  // 后台异步执行，立即返回
  reclassifyAllArticles(regenerateTags)
    .then((result) => console.log(`Reclassify all done: ${result.processed}/${result.total}`))
    .catch((e) => console.error('Reclassify all failed:', e.message));

  return c.json({ status: 'started' });
});

// 单篇文章重新分类
articlesRoutes.post('/articles/:id/reclassify', requireAuth, async (c) => {
  const id = Number(c.req.param('id'));
  const body = await c.req.json().catch(() => ({}));
  const regenerateTags = body.regenerateTags === true;

  try {
    const category = await reclassifyArticle(id, regenerateTags);
    return c.json({ articleId: id, category });
  } catch (e: any) {
    return c.json({ error: { code: 'RECLASSIFY_FAILED', message: e.message } }, 500);
  }
});
