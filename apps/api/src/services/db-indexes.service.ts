import { sql } from 'drizzle-orm';
import { db } from '../db/index.js';

/**
 * 运行时确保关键查询索引存在（幂等，可重复执行）。
 *
 * 索引依据实际查询模式分析：
 *  - article_metadata(user_id, article_id)：列表/详情 JOIN 的核心条件
 *  - article_metadata(user_id, is_archived, is_favorited)：inbox/favorites/archive 视图过滤与 counts
 *  - article_metadata(user_id, is_published) WHERE is_published：published 部分索引（仅索引已发布行）
 *  - mcp_request_logs(client_id, created_at DESC)：MCP 限流 COUNT 的时间窗口查询
 *  - collect_jobs(client_id, status)：MCP 并发采集数检查
 */
export async function ensureDatabaseIndexes(): Promise<void> {
  const statements: string[] = [
    `CREATE INDEX IF NOT EXISTS idx_article_metadata_user_article
       ON article_metadata (user_id, article_id)`,
    `CREATE INDEX IF NOT EXISTS idx_article_metadata_user_archived_favorited
       ON article_metadata (user_id, is_archived, is_favorited)`,
    `CREATE INDEX IF NOT EXISTS idx_article_metadata_user_published
       ON article_metadata (user_id, is_published) WHERE is_published = true`,
    `CREATE INDEX IF NOT EXISTS idx_mcp_request_logs_client_created
       ON mcp_request_logs (client_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS idx_collect_jobs_client_status
       ON collect_jobs (client_id, status)`,
  ];

  for (const statement of statements) {
    await db.execute(sql.raw(statement));
  }
}
