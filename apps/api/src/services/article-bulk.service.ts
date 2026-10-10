import { randomUUID } from 'node:crypto';
import { and, eq, inArray, sql } from 'drizzle-orm';

import { db } from '../db/index.js';
import { adminAuditLogs, aiGenerationJobs, articles, articleMetadata, collectJobs } from '../db/schema.js';
import { getArticleContent, processCoverImage } from './reader.service.js';
import { enqueueAiGeneration, queueArchiveAiIfNeeded } from './ai-generation.service.js';
import { getPendingCategory, moveArticlesToCategory } from './category.service.js';
import { resolveUserAiRuntimeConfig } from './user-ai-settings.service.js';
import type { ArticleBulkActionResult, ArticleBulkAiResult } from '@storing/shared';

export type SimpleArticleBulkAction =
  | 'favorite'
  | 'unfavorite'
  | 'archive'
  | 'unarchive'
  | 'delete'
  | 'permanent_delete'
  | 'publish'
  | 'unpublish';

export interface OwnedArticleBulkRecord {
  articleId: number;
  isFavorited: boolean;
  isArchived: boolean;
  isDeleted: boolean;
  isPublished: boolean;
  aiSummary: string | null;
  aiTags: string[] | null;
  categorySource: string | null;
}

export type PermanentDeleteScope = 'permanent' | 'metadata' | 'not_found';

export class PermanentDeleteNotFoundError extends Error {
  constructor() {
    super('文章不存在或无权访问');
    this.name = 'PermanentDeleteNotFoundError';
  }
}

export type ArticlePublishOutcome =
  | { status: 'succeeded'; publicUrl: string }
  | { status: 'skipped'; code: 'ALREADY_PUBLISHED' }
  | { status: 'failed'; code: string; message: string };

export type ArticleUnpublishOutcome =
  | { status: 'succeeded' }
  | { status: 'skipped'; code: 'ALREADY_UNPUBLISHED' };

export class AiConfigurationRequiredError extends Error {
  constructor() {
    super('请先配置 AI 模型');
    this.name = 'AiConfigurationRequiredError';
  }
}

function emptyResult(requestedCount: number): ArticleBulkActionResult {
  return { requestedCount, succeededIds: [], skipped: [], failed: [] };
}

async function loadOwnedArticleBulkRecords(
  userId: number,
  articleIds: number[],
): Promise<OwnedArticleBulkRecord[]> {
  if (articleIds.length === 0) return [];
  const rows = await db
    .select({
      articleId: articles.id,
      isFavorited: articleMetadata.isFavorited,
      isArchived: articleMetadata.isArchived,
      isDeleted: articleMetadata.isDeleted,
      isPublished: articleMetadata.isPublished,
      aiSummary: articleMetadata.aiSummary,
      aiTags: articleMetadata.aiTags,
      categorySource: articleMetadata.categorySource,
    })
    .from(articles)
    .innerJoin(articleMetadata, and(
      eq(articles.id, articleMetadata.articleId),
      eq(articleMetadata.userId, userId),
    ))
    .where(inArray(articles.id, articleIds));
  return rows.map((row) => ({
    ...row,
    isFavorited: row.isFavorited === true,
    isArchived: row.isArchived === true,
    isDeleted: row.isDeleted === true,
    isPublished: row.isPublished === true,
  }));
}

function selectIdsByState(
  records: OwnedArticleBulkRecord[],
  action: SimpleArticleBulkAction,
): { actionableIds: number[]; alreadyCodes: Map<number, string> } {
  const alreadyCodes = new Map<number, string>();
  const matches = (record: OwnedArticleBulkRecord) => {
    if (action === 'favorite') {
      if (record.isFavorited) alreadyCodes.set(record.articleId, 'ALREADY_FAVORITED');
      return !record.isFavorited;
    }
    if (action === 'unfavorite') {
      if (!record.isFavorited) alreadyCodes.set(record.articleId, 'ALREADY_UNFAVORITED');
      return record.isFavorited;
    }
    if (action === 'archive') {
      if (record.isArchived) alreadyCodes.set(record.articleId, 'ALREADY_ARCHIVED');
      return !record.isArchived;
    }
    if (action === 'unarchive') {
      if (!record.isArchived) alreadyCodes.set(record.articleId, 'ALREADY_UNARCHIVED');
      return record.isArchived;
    }
    if (action === 'permanent_delete') return true;
    if (action === 'publish') {
      if (record.isPublished) alreadyCodes.set(record.articleId, 'ALREADY_PUBLISHED');
      return !record.isPublished;
    }
    if (action === 'unpublish') {
      if (!record.isPublished) alreadyCodes.set(record.articleId, 'ALREADY_UNPUBLISHED');
      return record.isPublished;
    }
    if (record.isDeleted) alreadyCodes.set(record.articleId, 'ALREADY_DELETED');
    return !record.isDeleted;
  };

  return { actionableIds: records.filter(matches).map((record) => record.articleId), alreadyCodes };
}

export async function runSimpleArticleBulkAction(
  userId: number,
  action: SimpleArticleBulkAction,
  articleIds: number[],
): Promise<ArticleBulkActionResult> {
  const result = emptyResult(articleIds.length);
  const records = await loadOwnedArticleBulkRecords(userId, articleIds);
  const ownedById = new Map(records.map((record) => [record.articleId, record]));
  const { actionableIds, alreadyCodes } = selectIdsByState(records, action);
  const failedById = new Map<number, { articleId: number; code: string; message: string }>();
  const now = new Date();

  if (actionableIds.length > 0) {
    if (action === 'favorite') {
      await db.update(articleMetadata).set({
        isFavorited: true,
        favoritedAt: now,
        updatedAt: now,
      }).where(and(
        eq(articleMetadata.userId, userId),
        inArray(articleMetadata.articleId, actionableIds),
      ));
    } else if (action === 'unfavorite') {
      await db.update(articleMetadata).set({
        isFavorited: false,
        favoritedAt: null,
        updatedAt: now,
      }).where(and(
        eq(articleMetadata.userId, userId),
        inArray(articleMetadata.articleId, actionableIds),
      ));
    } else if (action === 'archive') {
      const pendingCategory = await getPendingCategory(userId);
      await db.update(articleMetadata).set({
        isArchived: true,
        archivedAt: now,
        categoryId: pendingCategory.id,
        categorySource: 'rule',
        categoryReviewStatus: 'needs_review',
        categoryConfidence: null,
        categoryReason: null,
        categoryModelVersion: null,
        updatedAt: now,
      }).where(and(
        eq(articleMetadata.userId, userId),
        inArray(articleMetadata.articleId, actionableIds),
      ));

      for (const articleId of actionableIds) {
        const record = ownedById.get(articleId);
        if (!record) continue;
        const existingAiReady = Boolean(record.aiSummary && record.aiTags?.length);
        queueArchiveAiIfNeeded(userId, articleId, {
          userSelectedCategory: false,
          existingAiReady,
        }).catch((error) => console.error('Bulk archive AI trigger failed:', error instanceof Error ? error.message : error));
        processCoverImage(articleId, userId).catch((error) => console.error('Bulk archive cover process failed:', error.message));
      }
    } else if (action === 'unarchive') {
      await db.update(articleMetadata).set({
        isArchived: false,
        archivedAt: null,
        updatedAt: now,
      }).where(and(
        eq(articleMetadata.userId, userId),
        inArray(articleMetadata.articleId, actionableIds),
      ));
    } else if (action === 'delete') {
      await db.update(articleMetadata).set({
        isDeleted: true,
        updatedAt: now,
      }).where(and(
        eq(articleMetadata.userId, userId),
        inArray(articleMetadata.articleId, actionableIds),
      ));
    } else if (action === 'publish' || action === 'unpublish') {
      for (const articleId of actionableIds) {
        try {
          if (action === 'publish') {
            const outcome = await publishArticleForUser(userId, articleId);
            if (outcome.status === 'succeeded') {
              (result.publications ??= []).push({ articleId, publicUrl: outcome.publicUrl });
            } else if (outcome.status === 'skipped') {
              alreadyCodes.set(articleId, outcome.code);
            } else {
              failedById.set(articleId, { articleId, code: outcome.code, message: outcome.message });
            }
          } else {
            const outcome = await unpublishArticleForUser(userId, articleId);
            if (outcome.status === 'skipped') alreadyCodes.set(articleId, outcome.code);
          }
        } catch (error) {
          console.error('Bulk publication action failed:', error instanceof Error ? error.message : error);
          failedById.set(articleId, {
            articleId,
            code: error instanceof PermanentDeleteNotFoundError ? 'NOT_FOUND' : 'PUBLICATION_ACTION_FAILED',
            message: error instanceof Error ? error.message : '发布状态更新失败',
          });
        }
      }
    } else {
      for (const articleId of actionableIds) {
        try {
          await permanentlyDeleteArticleForUser(userId, articleId);
        } catch (error) {
          if (!(error instanceof PermanentDeleteNotFoundError)) {
            console.error('Bulk permanent delete failed:', error instanceof Error ? error.message : error);
          }
          failedById.set(articleId, {
            articleId,
            code: error instanceof PermanentDeleteNotFoundError ? 'NOT_FOUND' : 'PERMANENT_DELETE_FAILED',
            message: error instanceof Error ? error.message : '彻底删除失败',
          });
        }
      }
    }
  }

  for (const articleId of articleIds) {
    const failure = failedById.get(articleId);
    if (failure) {
      result.failed.push(failure);
      continue;
    }
    if (!ownedById.has(articleId)) {
      result.skipped.push({ articleId, code: 'NOT_FOUND' });
    } else if (alreadyCodes.has(articleId)) {
      result.skipped.push({ articleId, code: alreadyCodes.get(articleId)! });
    } else {
      result.succeededIds.push(articleId);
    }
  }
  return result;
}

async function loadOwnedPublicationRecord(userId: number, articleId: number) {
  const [record] = await db
    .select({
      articleId: articles.id,
      isArchived: articleMetadata.isArchived,
      isPublished: articleMetadata.isPublished,
      archivedAt: articleMetadata.archivedAt,
      publicId: articleMetadata.publicId,
    })
    .from(articles)
    .innerJoin(articleMetadata, and(
      eq(articles.id, articleMetadata.articleId),
      eq(articleMetadata.userId, userId),
    ))
    .where(eq(articles.id, articleId))
    .limit(1);
  if (!record) throw new PermanentDeleteNotFoundError();
  return record;
}

export async function publishArticleForUser(
  userId: number,
  articleId: number,
): Promise<ArticlePublishOutcome> {
  const record = await loadOwnedPublicationRecord(userId, articleId);
  if (record.isPublished && record.publicId) {
    return { status: 'skipped', code: 'ALREADY_PUBLISHED' };
  }

  const now = new Date();
  const wasArchived = record.isArchived === true;
  if (!wasArchived) {
    const content = await getArticleContent(articleId, 'markdown', 'desktop', userId);
    if (!content) {
      return { status: 'failed', code: 'BODY_NOT_READY', message: '文章正文尚未准备完成，无法发布' };
    }
  }

  const pendingCategory = wasArchived ? null : await getPendingCategory(userId);
  const [updated] = await db.update(articleMetadata).set({
    isArchived: true,
    archivedAt: wasArchived ? record.archivedAt : now,
    ...(pendingCategory ? {
      categoryId: pendingCategory.id,
      categorySource: 'rule',
      categoryReviewStatus: 'needs_review',
    } : {}),
    isPublished: true,
    publishedAt: now,
    publicId: record.publicId || randomUUID(),
    updatedAt: now,
  }).where(and(
    eq(articleMetadata.articleId, articleId),
    eq(articleMetadata.userId, userId),
  )).returning({ publicId: articleMetadata.publicId });

  if (!updated?.publicId) {
    return { status: 'failed', code: 'PUBLIC_ID_FAILED', message: '公开链接生成失败' };
  }
  if (!wasArchived) {
    processCoverImage(articleId, userId).catch((error) => console.error('Publish cover process failed:', error.message));
  }
  return { status: 'succeeded', publicUrl: `/p/${updated.publicId}` };
}

export async function unpublishArticleForUser(
  userId: number,
  articleId: number,
): Promise<ArticleUnpublishOutcome> {
  const record = await loadOwnedPublicationRecord(userId, articleId);
  if (!record.isPublished) return { status: 'skipped', code: 'ALREADY_UNPUBLISHED' };

  await db.update(articleMetadata).set({
    isPublished: false,
    updatedAt: new Date(),
  }).where(and(
    eq(articleMetadata.articleId, articleId),
    eq(articleMetadata.userId, userId),
  ));
  return { status: 'succeeded' };
}

export async function permanentlyDeleteArticleForUser(
  userId: number,
  articleId: number,
): Promise<Exclude<PermanentDeleteScope, 'not_found'>> {
  const remainingCount = await db.transaction(async (tx) => {
    const [article] = await tx
      .select({ id: articles.id })
      .from(articles)
      .where(eq(articles.id, articleId))
      .for('update')
      .limit(1);
    if (!article) throw new PermanentDeleteNotFoundError();

    const [{ remaining }] = await tx
      .select({ remaining: sql<number>`COUNT(*)::int` })
      .from(articleMetadata)
      .where(and(eq(articleMetadata.articleId, articleId), sql`${articleMetadata.userId} != ${userId}`));
    if (Number(remaining) > 0) {
      await tx
        .update(articleMetadata)
        .set({ isDeleted: true, updatedAt: new Date() })
        .where(and(eq(articleMetadata.articleId, articleId), eq(articleMetadata.userId, userId)));
      return Number(remaining);
    }

    await tx.update(collectJobs).set({ articleId: null }).where(eq(collectJobs.articleId, articleId));
    await tx.update(adminAuditLogs).set({ articleId: null }).where(eq(adminAuditLogs.articleId, articleId));
    await tx.delete(articleMetadata).where(eq(articleMetadata.articleId, articleId));
    await tx.delete(articles).where(eq(articles.id, articleId));
    return 0;
  });

  return remainingCount === 0 ? 'permanent' : 'metadata';
}

export async function runBulkArticleCategory(
  userId: number,
  articleIds: number[],
  categoryId: number,
): Promise<ArticleBulkActionResult> {
  if (!Number.isInteger(categoryId) || categoryId <= 0) throw new Error('分类 ID 无效');

  const result = emptyResult(articleIds.length);
  const records = await loadOwnedArticleBulkRecords(userId, articleIds);
  const ownedById = new Map(records.map((record) => [record.articleId, record]));
  const actionableIds: number[] = [];
  for (const articleId of articleIds) {
    const record = ownedById.get(articleId);
    if (!record) {
      result.skipped.push({ articleId, code: 'NOT_FOUND' });
    } else if (record.isArchived !== true) {
      result.skipped.push({ articleId, code: 'NOT_ARCHIVED' });
    } else {
      actionableIds.push(articleId);
    }
  }

  if (actionableIds.length > 0) {
    await moveArticlesToCategory(userId, actionableIds, categoryId);
    result.succeededIds.push(...actionableIds);
  }
  return result;
}

export async function enqueueBulkArticleAi(
  userId: number,
  articleIds: number[],
  options: { includeCategory: boolean },
): Promise<ArticleBulkAiResult> {
  const runtimeConfig = await resolveUserAiRuntimeConfig(userId);
  if (!runtimeConfig) throw new AiConfigurationRequiredError();

  const result: ArticleBulkAiResult = {
    requestedCount: articleIds.length,
    queuedIds: [],
    alreadyQueuedIds: [],
    failed: [],
  };
  const records = await loadOwnedArticleBulkRecords(userId, articleIds);
  const ownedById = new Map(records.map((record) => [record.articleId, record]));
  const activeJobs = await db
    .select({ articleId: aiGenerationJobs.articleId })
    .from(aiGenerationJobs)
    .where(and(
      eq(aiGenerationJobs.userId, userId),
      inArray(aiGenerationJobs.articleId, articleIds),
      inArray(aiGenerationJobs.status, ['queued', 'running']),
    ));
  const alreadyQueuedIds = new Set(activeJobs.map((job) => job.articleId));

  for (const articleId of articleIds) {
    const record = ownedById.get(articleId);
    if (!record) {
      result.failed.push({ articleId, code: 'NOT_FOUND', message: '文章不存在或无权访问' });
      continue;
    }
    if (options.includeCategory && (record.isArchived !== true || record.categorySource === 'user')) {
      result.failed.push({
        articleId,
        code: record.isArchived !== true ? 'NOT_ARCHIVED' : 'CATEGORY_USER_OVERRIDE',
        message: record.isArchived !== true ? '仅归档文章可以重新判断分类' : '文章分类已由用户确认，不能自动覆盖',
      });
      continue;
    }
    if (alreadyQueuedIds.has(articleId)) {
      result.alreadyQueuedIds.push(articleId);
      continue;
    }

    try {
      const job = await enqueueAiGeneration({
        userId,
        articleId,
        triggerType: 'manual',
        includeCategory: options.includeCategory,
      });
      if (job.status === 'queued' || job.status === 'running') {
        result.queuedIds.push(articleId);
      } else {
        result.failed.push({
          articleId,
          code: 'AI_GENERATION_FAILED',
          message: job.status === 'not_configured' ? '请先配置 AI 模型' : 'AI 任务创建失败',
        });
      }
    } catch (error) {
      console.error('Bulk AI enqueue failed:', error instanceof Error ? error.message : error);
      result.failed.push({
        articleId,
        code: 'AI_GENERATION_FAILED',
        message: error instanceof Error ? error.message : 'AI 任务创建失败',
      });
    }
  }
  return result;
}
