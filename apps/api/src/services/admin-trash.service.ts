import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { adminAuditLogs, articleMetadata, articles, collectJobs } from '../db/schema.js';
import { writeAdminAudit } from './admin-audit.service.js';
import { getAdminUserId } from './metadata-scope.service.js';

export interface AdminTrashBulkFailure {
  articleId: number;
  userId?: number | null;
  title: string | null;
  reason: string;
}

export interface AdminTrashBulkResult {
  scope: 'deleted' | 'orphans';
  attempted: number;
  succeeded: number;
  failed: number;
  deletedMetadata: number;
  deletedArticles: number;
  failures: AdminTrashBulkFailure[];
}

function changedFailure(): Error {
  return new Error('文章状态已变化，请刷新后重试');
}

function failureText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function unlinkArticleReferences(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  articleId: number,
): Promise<void> {
  await tx.update(collectJobs).set({ articleId: null }).where(eq(collectJobs.articleId, articleId));
  await tx.update(adminAuditLogs).set({ articleId: null }).where(eq(adminAuditLogs.articleId, articleId));
}

async function auditBulkClear(
  actorUserId: number | undefined,
  action: 'article_trash_emptied' | 'orphan_trash_emptied',
  result: AdminTrashBulkResult,
): Promise<void> {
  const actor = actorUserId ?? await getAdminUserId();
  try {
    await writeAdminAudit({
      actorUserId: actor,
      articleId: null,
      action,
      detail: {
        scope: result.scope,
        attempted: result.attempted,
        succeeded: result.succeeded,
        failed: result.failed,
        deleted_metadata: result.deletedMetadata,
        deleted_articles: result.deletedArticles,
        failures: result.failures,
      },
    });
  } catch (error) {
    console.error('Admin trash bulk audit failed:', failureText(error));
  }
}

export async function clearAdminTrash(actorUserId?: number): Promise<AdminTrashBulkResult> {
  const candidates = await db
    .select({
      articleId: articleMetadata.articleId,
      userId: articleMetadata.userId,
      title: articles.title,
    })
    .from(articleMetadata)
    .innerJoin(articles, eq(articles.id, articleMetadata.articleId))
    .where(eq(articleMetadata.isDeleted, true))
    .orderBy(articleMetadata.articleId, articleMetadata.userId);

  const grouped = new Map<number, typeof candidates>();
  for (const candidate of candidates) {
    const group = grouped.get(candidate.articleId) ?? [];
    group.push(candidate);
    grouped.set(candidate.articleId, group);
  }

  let succeeded = 0;
  let deletedMetadata = 0;
  let deletedArticles = 0;
  const failures: AdminTrashBulkFailure[] = [];

  for (const [articleId, group] of grouped) {
    try {
      const outcome = await db.transaction(async (tx) => {
        const [article] = await tx
          .select({ id: articles.id })
          .from(articles)
          .where(eq(articles.id, articleId))
          .for('update')
          .limit(1);
        if (!article) throw changedFailure();

        await tx
          .select({ id: articleMetadata.id })
          .from(articleMetadata)
          .where(and(eq(articleMetadata.articleId, articleId), eq(articleMetadata.isDeleted, true)))
          .for('update');

        const activeMetadata = await tx
          .select({ id: articleMetadata.id })
          .from(articleMetadata)
          .where(and(eq(articleMetadata.articleId, articleId), eq(articleMetadata.isDeleted, false)))
          .for('update');

        const removed = await tx
          .delete(articleMetadata)
          .where(and(eq(articleMetadata.articleId, articleId), eq(articleMetadata.isDeleted, true)))
          .returning({ userId: articleMetadata.userId });
        if (removed.length === 0) throw changedFailure();

        if (activeMetadata.length === 0) {
          await unlinkArticleReferences(tx, articleId);
          await tx.delete(articleMetadata).where(eq(articleMetadata.articleId, articleId));
          await tx.delete(articles).where(eq(articles.id, articleId));
          return { removedMetadata: removed.length, removedArticle: true };
        }

        // 同一文章仍有人保留时只清掉删除态元数据，不能连带删除活跃用户的数据。
        return { removedMetadata: removed.length, removedArticle: false };
      });

      succeeded += outcome.removedMetadata;
      deletedMetadata += outcome.removedMetadata;
      if (outcome.removedArticle) deletedArticles += 1;
    } catch (error) {
      const reason = failureText(error);
      failures.push(...group.map((candidate) => ({
        articleId,
        userId: candidate.userId,
        title: candidate.title,
        reason,
      })));
    }
  }

  const result: AdminTrashBulkResult = {
    scope: 'deleted',
    attempted: succeeded + failures.length,
    succeeded,
    failed: failures.length,
    deletedMetadata,
    deletedArticles,
    failures,
  };
  await auditBulkClear(actorUserId, 'article_trash_emptied', result);
  return result;
}

export async function clearAdminTrashOrphans(actorUserId?: number): Promise<AdminTrashBulkResult> {
  const candidates = await db
    .select({ articleId: articles.id, title: articles.title })
    .from(articles)
    .where(
      sql`NOT EXISTS (SELECT 1 FROM ${articleMetadata} WHERE ${articleMetadata.articleId} = ${articles.id})`,
    )
    .orderBy(articles.id);

  let succeeded = 0;
  const failures: AdminTrashBulkFailure[] = [];

  for (const candidate of candidates) {
    try {
      await db.transaction(async (tx) => {
        const [article] = await tx
          .select({ id: articles.id })
          .from(articles)
          .where(eq(articles.id, candidate.articleId))
          .for('update')
          .limit(1);
        if (!article) throw changedFailure();

        const owners = await tx
          .select({ id: articleMetadata.id })
          .from(articleMetadata)
          .where(eq(articleMetadata.articleId, candidate.articleId))
          .for('update');
        if (owners.length > 0) throw changedFailure();

        await unlinkArticleReferences(tx, candidate.articleId);
        await tx.delete(articles).where(eq(articles.id, candidate.articleId));
      });
      succeeded += 1;
    } catch (error) {
      failures.push({
        articleId: candidate.articleId,
        userId: null,
        title: candidate.title,
        reason: failureText(error),
      });
    }
  }

  const result: AdminTrashBulkResult = {
    scope: 'orphans',
    attempted: candidates.length,
    succeeded,
    failed: candidates.length - succeeded,
    deletedMetadata: 0,
    deletedArticles: succeeded,
    failures,
  };
  await auditBulkClear(actorUserId, 'orphan_trash_emptied', result);
  return result;
}
