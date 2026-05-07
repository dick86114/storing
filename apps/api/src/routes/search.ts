import { Hono } from 'hono';
import { db } from '../db/index.js';
import { articles, articleMetadata } from '../db/schema.js';
import { sql, desc, eq } from 'drizzle-orm';

export const searchRoutes = new Hono();

searchRoutes.get('/search', async (c) => {
  const q = c.req.query('q');
  if (!q?.trim()) {
    return c.json({ articles: [], total: 0, page: 1, perPage: 20, totalPages: 0 });
  }

  const page = parseInt(c.req.query('page') || '1');
  const perPage = parseInt(c.req.query('perPage') || '20');
  const pattern = `%${q}%`;

  const searchCondition = sql`${articles.title} ILIKE ${pattern} OR ${articles.source} ILIKE ${pattern} OR ${articles.summary} ILIKE ${pattern} OR ${articleMetadata.aiSummary} ILIKE ${pattern} OR ${articleMetadata.aiCategory} ILIKE ${pattern} OR array_to_string(${articleMetadata.aiTags}, ' ') ILIKE ${pattern}`;

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(articles)
    .leftJoin(articleMetadata, eq(articles.id, articleMetadata.articleId))
    .where(searchCondition);

  const data = await db
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
      isFavorited: articleMetadata.isFavorited,
      isArchived: articleMetadata.isArchived,
      aiSummary: articleMetadata.aiSummary,
      aiCategory: articleMetadata.aiCategory,
      aiTags: articleMetadata.aiTags,
    })
    .from(articles)
    .leftJoin(articleMetadata, eq(articles.id, articleMetadata.articleId))
    .where(searchCondition)
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
