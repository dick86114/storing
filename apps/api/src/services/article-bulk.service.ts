import { and, eq, inArray } from 'drizzle-orm';

import { db } from '../db/index.js';
import { articles, articleMetadata } from '../db/schema.js';
import { processCoverImage } from './reader.service.js';
import { queueArchiveAiIfNeeded } from './ai-generation.service.js';
import { getPendingCategory } from './category.service.js';
import type { ArticleBulkActionResult } from '@storing/shared';

export type SimpleArticleBulkAction =
  | 'favorite'
  | 'unfavorite'
  | 'archive'
  | 'unarchive'
  | 'delete';

export interface OwnedArticleBulkRecord {
  articleId: number;
  isFavorited: boolean;
  isArchived: boolean;
  isDeleted: boolean;
  aiSummary: string | null;
  aiTags: string[] | null;
}

function emptyResult(requestedCount: number): ArticleBulkActionResult {
  return { requestedCount, succeededIds: [], skipped: [], failed: [] };
}

async function loadOwnedArticleBulkRecords(
  userId: number,
  articleIds: number[],
): Promise<OwnedArticleBulkRecord[]> {
  if (articleIds.length === 0) return [];
  return db
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
    } else {
      await db.update(articleMetadata).set({
        isDeleted: true,
        updatedAt: now,
      }).where(and(
        eq(articleMetadata.userId, userId),
        inArray(articleMetadata.articleId, actionableIds),
      ));
    }
  }

  for (const articleId of articleIds) {
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

