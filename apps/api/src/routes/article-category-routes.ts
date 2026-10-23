import type { Context } from 'hono';
import { CategoryServiceError } from '../services/category.service.js';

export interface 更新文章分类依赖 {
  currentUserID: (c: Context) => number;
  moveArticlesToCategory: (
    userId: number,
    articleIDs: number[],
    categoryID: number,
  ) => Promise<{ updatedCount: number }>;
}

/** 单篇修改分类的实际路由处理器，依赖可注入以便验证真实响应契约。 */
export function createUpdateArticleCategoryHandler(依赖: 更新文章分类依赖) {
  return async (c: Context) => {
    const id = Number(c.req.param('id'));
    const body = await c.req.json().catch(() => null) as { categoryId?: unknown } | null;
    if (!Number.isInteger(id) || id <= 0 || !body || typeof body.categoryId !== 'number') {
      return c.json({ error: { code: 'BAD_REQUEST', message: '文章或分类 ID 无效' } }, 400);
    }

    try {
      const result = await 依赖.moveArticlesToCategory(
        依赖.currentUserID(c),
        [id],
        body.categoryId,
      );
      return c.json({ articleId: id, updatedCount: result.updatedCount });
    } catch (error) {
      if (error instanceof CategoryServiceError) {
        if (error.code === 'CATEGORY_NOT_FOUND' || error.code === 'CATEGORY_INACTIVE') {
          return c.json({ error: { code: 'CATEGORY_UNAVAILABLE', message: error.message } }, 404);
        }
        if (error.code === 'ARTICLE_ACCESS_DENIED') {
          return c.json({ error: { code: 'CONTENT_UNAVAILABLE', message: error.message } }, 404);
        }
        if (error.code === 'CATEGORY_INVALID_INPUT') {
          return c.json({ error: { code: 'BAD_REQUEST', message: error.message } }, 400);
        }
      }
      return c.json({
        error: {
          code: 'CATEGORY_UPDATE_FAILED',
          message: error instanceof Error ? error.message : '修改分类失败',
        },
      }, 400);
    }
  };
}

export interface 归档文章记录 {
  isArchived: boolean | null;
  categoryId?: number | null;
  aiSummary?: string | null;
  aiTags?: string[] | null;
}

export interface 归档分类 {
  id: number;
  name: string;
}

export interface 归档元数据更新 {
  isArchived: true;
  archivedAt?: Date;
  updatedAt: Date;
  categoryId?: number;
  categorySource?: 'user' | 'rule';
  categoryReviewStatus?: 'confirmed' | 'needs_review';
  categoryConfidence?: null;
  categoryReason?: null;
  categoryModelVersion?: null;
}

export interface 归档文章依赖 {
  currentUserID: (c: Context) => number;
  getArticleRecord: (articleID: number, userID: number) => Promise<归档文章记录 | null>;
  getCategoryById: (
    userID: number,
    categoryID: number,
    options: { requireActive: true },
  ) => Promise<归档分类 | null>;
  getPendingCategory: (userID: number) => Promise<归档分类 | null>;
  hasMetadataTimestampColumns: () => Promise<boolean>;
  updateMetadata: (
    articleID: number,
    userID: number,
    values: 归档元数据更新,
  ) => Promise<void>;
  queueArchiveAI: (
    userID: number,
    articleID: number,
    options: { userSelectedCategory: boolean; existingAiReady: boolean },
  ) => Promise<unknown> | unknown;
  enqueueCoverImage: (articleID: number, userID: number) => void;
}

/** 单篇归档的实际路由处理器，分类失效与文章失效使用不同错误码。 */
export function createArchiveArticleHandler(依赖: 归档文章依赖) {
  return async (c: Context) => {
    const id = Number(c.req.param('id'));
    if (!Number.isInteger(id) || id <= 0) {
      return c.json({ error: { code: 'BAD_REQUEST', message: 'Missing id' } }, 400);
    }

    const userID = 依赖.currentUserID(c);
    const ownedArticle = await 依赖.getArticleRecord(id, userID);
    if (!ownedArticle) {
      return c.json({ error: { code: 'CONTENT_UNAVAILABLE', message: '文章不存在或无权访问' } }, 404);
    }

    const body = await c.req.json().catch(() => ({})) as { categoryId?: unknown };
    const requestedCategoryID = typeof body.categoryId === 'number' ? body.categoryId : null;
    if (
      requestedCategoryID !== null
      && (!Number.isInteger(requestedCategoryID) || requestedCategoryID <= 0)
    ) {
      return c.json({ error: { code: 'BAD_REQUEST', message: '分类 ID 无效' } }, 400);
    }

    const category = requestedCategoryID
      ? await 依赖.getCategoryById(userID, requestedCategoryID, { requireActive: true }).catch(() => null)
      : ownedArticle.isArchived && ownedArticle.categoryId
        ? null
        : await 依赖.getPendingCategory(userID);

    if (requestedCategoryID && !category) {
      return c.json({
        error: {
          code: 'CATEGORY_UNAVAILABLE',
          message: '分类不存在、已停用或无权访问',
        },
      }, 404);
    }

    const now = new Date();
    const hasActionTimestamps = await 依赖.hasMetadataTimestampColumns();
    const updateValues: 归档元数据更新 = {
      isArchived: true,
      updatedAt: now,
      ...(hasActionTimestamps ? { archivedAt: now } : {}),
      ...(category ? {
        categoryId: category.id,
        categorySource: requestedCategoryID ? 'user' as const : 'rule' as const,
        categoryReviewStatus: requestedCategoryID ? 'confirmed' as const : 'needs_review' as const,
        categoryConfidence: null,
        categoryReason: null,
        categoryModelVersion: null,
      } : {}),
    };

    await 依赖.updateMetadata(id, userID, updateValues);

    const existingAiReady = Boolean(ownedArticle.aiSummary && ownedArticle.aiTags?.length);
    Promise.resolve(依赖.queueArchiveAI(userID, id, {
      userSelectedCategory: Boolean(requestedCategoryID),
      existingAiReady,
    })).catch((error) => {
      console.error('Archive AI trigger failed:', error instanceof Error ? error.message : error);
    });
    依赖.enqueueCoverImage(id, userID);

    return c.json({
      articleId: id,
      isArchived: true,
      category: category ? { id: category.id, name: category.name } : null,
    });
  };
}
