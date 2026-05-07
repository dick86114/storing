import { Hono } from 'hono';
import { db } from '../db/index.js';
import { articles, articleMetadata } from '../db/schema.js';
import { eq, and, desc, count, sql, or, isNull } from 'drizzle-orm';
import { classifyAndTag } from '../services/ai.service.js';
import { getArticleContent } from '../services/reader.service.js';

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
 */
articlesRoutes.get('/articles', async (c) => {
  const view = c.req.query('view') || 'inbox';
  const category = c.req.query('category');
  const page = parseInt(c.req.query('page') || '1');
  const perPage = parseInt(c.req.query('perPage') || '8');

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
      coverImage: articles.coverImage,
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
 */
articlesRoutes.get('/articles/:id', async (c) => {
  const id = parseInt(c.req.param('id'));
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

  // 获取 markdown 正文（首次抓取并缓存，后续读库）
  const contentMd = await getArticleContent(id).catch((e) => {
    console.error('Fetch markdown failed:', e.message);
    return null;
  });

  return c.json({
    ...article,
    contentMd,
    isFavorited: article.isFavorited ?? false,
    isArchived: article.isArchived ?? false,
    aiTags: article.aiTags ?? [],
  });
});

/**
 * POST /articles/:id/favorite — 切换收藏状态
 */
articlesRoutes.post('/articles/:id/favorite', async (c) => {
  const id = parseInt(c.req.param('id'));

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
 */
articlesRoutes.post('/articles/:id/archive', async (c) => {
  const id = parseInt(c.req.param('id'));

  const [article] = await db.select().from(articles).where(eq(articles.id, id));
  if (!article) return c.json({ error: { code: 'NOT_FOUND', message: 'Article not found' } }, 404);

  await ensureMetadata(id);

  const [updated] = await db
    .update(articleMetadata)
    .set({ isArchived: true, updatedAt: new Date() })
    .where(eq(articleMetadata.articleId, id))
    .returning();

  // 异步触发 AI 分类和标签
  classifyAndTag(id).catch((e) => console.error('AI classify/tag failed:', e.message));

  return c.json({ ...updated, articleId: id });
});

/**
 * POST /articles/:id/unarchive — 取消归档
 */
articlesRoutes.post('/articles/:id/unarchive', async (c) => {
  const id = parseInt(c.req.param('id'));

  await ensureMetadata(id);

  const [updated] = await db
    .update(articleMetadata)
    .set({ isArchived: false, updatedAt: new Date() })
    .where(eq(articleMetadata.articleId, id))
    .returning();

  return c.json({ ...updated, articleId: id });
});

/**
 * GET /categories — 归档分类统计
 */
articlesRoutes.get('/categories', async (c) => {
  const rows = await db
    .select({ category: articleMetadata.aiCategory, count: count() })
    .from(articleMetadata)
    .where(and(eq(articleMetadata.isArchived, true), sql`${articleMetadata.aiCategory} IS NOT NULL`))
    .groupBy(articleMetadata.aiCategory);
  return c.json(rows);
});

/**
 * GET /articles/:id/position — 查找文章在某个视图中的页码位置
 */
articlesRoutes.get('/articles/:id/position', async (c) => {
  const id = parseInt(c.req.param('id'));
  const view = c.req.query('view') || 'inbox';
  const category = c.req.query('category');
  const perPage = parseInt(c.req.query('perPage') || '18');

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
