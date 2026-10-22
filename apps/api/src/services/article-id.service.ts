import { sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { articles } from '../db/schema.js';

type ArticleIdTransaction = Parameters<Parameters<typeof db.transaction>[0]>[0];

/** 所有 MAX(id)+1 写入方共用同一事务锁，避免跨业务并发主键冲突。 */
export async function allocateArticleIdInTransaction(tx: ArticleIdTransaction): Promise<number> {
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('storing:article-id'))`);
  const [row] = await tx
    .select({ nextId: sql<number>`COALESCE(MAX(${articles.id}), 0) + 1` })
    .from(articles);
  return Number(row?.nextId || 1);
}
