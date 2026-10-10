import { and, eq, inArray, sql } from 'drizzle-orm';

import { db } from '../db/index.js';
import { adminAuditLogs, articles, articleMetadata, collectJobs } from '../db/schema.js';
import { processCoverImage } from './reader.service.js';
import { queueArchiveAiIfNeeded } from './ai-generation.service.js';
import { getPendingCategory } from './category.service.js';
import type { ArticleBulkActionResult } from '@storing/shared';

export type SimpleArticleBulkAction =
  | 'favorite'
  | 'unfavorite'
  | 'archive'
  | 'unarchive'
  | 'delete'
  | 'permanent_delete';

export interface OwnedArticleBulkRecord {
  articleId: number;
  isFavorited: boolean;
  isArchived: boolean;
  isDeleted: boolean;
  aiSummary: string | null;
  aiTags: string[] | null;
}

export type PermanentDeleteScope = 'permanent' | 'metadata' | 'not_found';

export class PermanentDeleteNotFoundError extends Error {
  constructor() {
    super('文章不存在或无权访问');
    this.name = 'PermanentDeleteNotFoundError';
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
      aiSummary: articleMetadata.aiSummary,
      aiTags: articleMetadata.aiTags,
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

