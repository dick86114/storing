import { Hono } from 'hono';
import { db } from '../db/index.js';
import { articles, articleMetadata, users } from '../db/schema.js';
import { sql, desc, eq, and } from 'drizzle-orm';
import { optionalAuth, isAuthenticated, getCurrentUser } from '../middleware/auth.js';

export const searchRoutes = new Hono();

async function getDefaultUserId() {
  const adminUsername = process.env.ADMIN_USERNAME || 'admin';
  const [admin] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.username, adminUsername))
    .limit(1);
  if (!admin) throw new Error(`Admin user not found: ${adminUsername}`);
  return admin.id;
}

async function getScopedUserId(c: any) {
  if (isAuthenticated(c)) return getCurrentUser(c).id as number;
  return getDefaultUserId();
}

function metadataJoinCondition(userId: number) {
  return and(eq(articles.id, articleMetadata.articleId), eq(articleMetadata.userId, userId));
}

/**
 * GET /search — 全文搜索
 * 游客只能搜索归档文章
 */
searchRoutes.get('/search', optionalAuth, async (c) => {
  const q = c.req.query('q');
  if (!q?.trim()) {
    return c.json({ articles: [], total: 0, page: 1, perPage: 20, totalPages: 0 });
  }

  const page = parseInt(c.req.query('page') || '1');
  const perPage = parseInt(c.req.query('perPage') || '20');
  const pattern = `%${q}%`;
  const userId = await getScopedUserId(c);

  const searchCondition = sql`(${articles.title} ILIKE ${pattern} OR ${articles.source} ILIKE ${pattern} OR ${articles.summary} ILIKE ${pattern} OR ${articleMetadata.aiSummary} ILIKE ${pattern} OR ${articleMetadata.aiCategory} ILIKE ${pattern} OR array_to_string(${articleMetadata.aiTags}, ' ') ILIKE ${pattern})`;

  // 游客只能搜索归档文章
  const finalCondition = isAuthenticated(c)
    ? searchCondition
    : and(searchCondition, eq(articleMetadata.isArchived, true));

  const [{ total }] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(articles)
    .innerJoin(articleMetadata, metadataJoinCondition(userId))
    .where(finalCondition);

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
    .innerJoin(articleMetadata, metadataJoinCondition(userId))
    .where(finalCondition)
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
