import assert from 'node:assert/strict';
import test from 'node:test';
import { Hono } from 'hono';
import {
  createArchiveArticleHandler,
  createUpdateArticleCategoryHandler,
} from '../src/routes/article-category-routes.js';
import { CategoryServiceError } from '../src/services/category.service.js';

function 更新分类应用(
  移动结果: Error | null,
  记录调用?: (userID: number, articleIDs: number[], categoryID: number) => void,
) {
  const app = new Hono();
  app.patch('/articles/:id/category', createUpdateArticleCategoryHandler({
    currentUserID: () => 7,
    moveArticlesToCategory: async (userID, articleIDs, categoryID) => {
      记录调用?.(userID, articleIDs, categoryID);
      if (移动结果) throw 移动结果;
      return { updatedCount: 1 };
    },
  }));
  return app;
}

function 归档应用(options: {
  文章?: { isArchived: boolean; categoryId?: number | null; aiSummary?: string | null; aiTags?: string[] | null } | null;
  分类?: { id: number; name: string } | null;
  待整理?: { id: number; name: string } | null;
  记录更新?: (articleID: number, userID: number, values: Record<string, unknown>) => void;
  记录AI?: (userID: number, articleID: number, options: { userSelectedCategory: boolean; existingAiReady: boolean }) => void;
}) {
  const app = new Hono();
  app.post('/articles/:id/archive', createArchiveArticleHandler({
    currentUserID: () => 7,
    getArticleRecord: async () => options.文章 ?? null,
    getCategoryById: async () => options.分类 ?? null,
    getPendingCategory: async () => options.待整理 ?? null,
    hasMetadataTimestampColumns: async () => false,
    updateMetadata: async (articleID, userID, values) => {
      options.记录更新?.(articleID, userID, values as unknown as Record<string, unknown>);
    },
    queueArchiveAI: async (userID, articleID, queueOptions) => {
      options.记录AI?.(userID, articleID, queueOptions);
    },
    enqueueCoverImage: () => {},
  }));
  return app;
}

async function 请求更新分类(app: Hono, articleID = 12) {
  const response = await app.request(`http://api.example.test/articles/${articleID}/category`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ categoryId: 31 }),
  });
  return { response, body: await response.json() as any };
}

async function 请求归档(app: Hono, articleID = 12) {
  const response = await app.request(`http://api.example.test/articles/${articleID}/archive`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ categoryId: 31 }),
  });
  return { response, body: await response.json() as any };
}

test('单篇修改分类路由将分类失效与文章失效映射为不同错误码', async () => {
  const 分类不存在 = await 请求更新分类(更新分类应用(
    new CategoryServiceError('CATEGORY_NOT_FOUND', '分类不存在或无权访问'),
  ));
  assert.equal(分类不存在.response.status, 404);
  assert.equal(分类不存在.body.error.code, 'CATEGORY_UNAVAILABLE');
  assert.equal(分类不存在.body.error.message, '分类不存在或无权访问');

  const 分类停用 = await 请求更新分类(更新分类应用(
    new CategoryServiceError('CATEGORY_INACTIVE', '分类已停用，不能用于归类'),
  ));
  assert.equal(分类停用.response.status, 404);
  assert.equal(分类停用.body.error.code, 'CATEGORY_UNAVAILABLE');
  assert.equal(分类停用.body.error.message, '分类已停用，不能用于归类');

  const 文章失效 = await 请求更新分类(更新分类应用(
    new CategoryServiceError('ARTICLE_ACCESS_DENIED', '文章不存在或不属于当前用户'),
  ));
  assert.equal(文章失效.response.status, 404);
  assert.equal(文章失效.body.error.code, 'CONTENT_UNAVAILABLE');
  assert.equal(文章失效.body.error.message, '文章不存在或不属于当前用户');
});

test('单篇归档路优先区分文章失效与分类失效', async () => {
  const 文章失效 = await 请求归档(归档应用({ 文章: null }));
  assert.equal(文章失效.response.status, 404);
  assert.equal(文章失效.body.error.code, 'CONTENT_UNAVAILABLE');
  assert.equal(文章失效.body.error.message, '文章不存在或无权访问');

  const 分类失效 = await 请求归档(归档应用({
    文章: { isArchived: false },
    分类: null,
  }));
  assert.equal(分类失效.response.status, 404);
  assert.equal(分类失效.body.error.code, 'CATEGORY_UNAVAILABLE');
  assert.equal(分类失效.body.error.message, '分类不存在、已停用或无权访问');
});

test('单篇分类与归档成功路径继续使用同一分类 ID 并保留业务字段', async () => {
  let 分类调用: { userID: number; articleIDs: number[]; categoryID: number } | null = null;
  const 分类响应 = await 请求更新分类(更新分类应用(null, (userID, articleIDs, categoryID) => {
    分类调用 = { userID, articleIDs, categoryID };
  }));
  assert.equal(分类响应.response.status, 200);
  assert.deepEqual(分类调用, { userID: 7, articleIDs: [12], categoryID: 31 });
  assert.deepEqual(分类响应.body, { articleId: 12, updatedCount: 1 });

  let 元数据更新: Record<string, unknown> | null = null;
  let AI选项: { userSelectedCategory: boolean; existingAiReady: boolean } | null = null;
  const 归档响应 = await 请求归档(归档应用({
    文章: { isArchived: false, aiSummary: '已有摘要', aiTags: ['已有标签'] },
    分类: { id: 31, name: '产品设计' },
    记录更新: (_articleID, _userID, values) => { 元数据更新 = values; },
    记录AI: (_userID, _articleID, options) => { AI选项 = options; },
  }));
  assert.equal(归档响应.response.status, 200);
  assert.equal(元数据更新?.categoryId, 31);
  assert.equal(元数据更新?.categorySource, 'user');
  assert.equal(元数据更新?.categoryReviewStatus, 'confirmed');
  assert.deepEqual(AI选项, { userSelectedCategory: true, existingAiReady: true });
  assert.deepEqual(归档响应.body.category, { id: 31, name: '产品设计' });
});
