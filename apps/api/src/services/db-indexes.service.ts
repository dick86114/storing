import { sql } from 'drizzle-orm';
import { db } from '../db/index.js';

/**
 * 需要确保存在的索引定义。
 * 统一使用 CONCURRENTLY 建索引，不锁表、不阻塞生产库读写。
 */
const INDEXES: ReadonlyArray<{ name: string; create: string }> = [
  {
    name: 'idx_article_metadata_user_article',
    create: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_article_metadata_user_article ON article_metadata (user_id, article_id)',
  },
  {
    name: 'idx_article_metadata_user_archived_favorited',
    create: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_article_metadata_user_archived_favorited ON article_metadata (user_id, is_archived, is_favorited)',
  },
  {
    name: 'idx_article_metadata_user_published',
    create: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_article_metadata_user_published ON article_metadata (user_id, is_published) WHERE is_published = true',
  },
  {
    name: 'idx_categories_user_active_sort',
    create: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_categories_user_active_sort ON categories (user_id, is_active, sort_order)',
  },
  {
    name: 'categories_user_active_name_unique',
    create: 'CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS categories_user_active_name_unique ON categories (user_id, name) WHERE is_active = true',
  },
  {
    name: 'categories_user_pending_system_unique',
    create: "CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS categories_user_pending_system_unique ON categories (user_id) WHERE is_system = true AND name = '待整理'",
  },
  {
    name: 'idx_article_metadata_user_category_archived',
    create: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_article_metadata_user_category_archived ON article_metadata (user_id, category_id, is_archived)',
  },
  {
    name: 'idx_mcp_request_logs_client_created',
    create: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mcp_request_logs_client_created ON mcp_request_logs (client_id, created_at DESC)',
  },
  {
    name: 'idx_collect_jobs_client_status',
    create: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_collect_jobs_client_status ON collect_jobs (client_id, status)',
  },
  // trigram 索引：让 search 路由的 ILIKE '%keyword%' 走 GIN 索引，避免全表扫描
  {
    name: 'idx_articles_title_trgm',
    create: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_articles_title_trgm ON articles USING gin (title gin_trgm_ops)',
  },
  {
    name: 'idx_articles_source_trgm',
    create: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_articles_source_trgm ON articles USING gin (source gin_trgm_ops)',
  },
  {
    name: 'idx_articles_summary_trgm',
    create: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_articles_summary_trgm ON articles USING gin (summary gin_trgm_ops)',
  },
  {
    name: 'idx_article_metadata_ai_summary_trgm',
    create: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_article_metadata_ai_summary_trgm ON article_metadata USING gin (ai_summary gin_trgm_ops)',
  },
  {
    name: 'idx_article_metadata_ai_category_trgm',
    create: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_article_metadata_ai_category_trgm ON article_metadata USING gin (ai_category gin_trgm_ops)',
  },
  {
    // array_to_string 非 IMMUTABLE 无法建表达式 trigram 索引，改用 GIN 数组索引支持 @> 包含查询
    name: 'idx_article_metadata_ai_tags_gin',
    create: 'CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_article_metadata_ai_tags_gin ON article_metadata USING gin (ai_tags)',
  },
];

/**
 * 运行时确保关键查询索引存在（幂等，可重复执行）。
 *
 * 生产安全要点：
 *  - 使用 CREATE INDEX CONCURRENTLY，不锁表、不阻塞读写
 *  - CONCURRENTLY 不能在事务块里；drizzle db.execute 默认自动提交，满足要求
 *  - CONCURRENTLY 偶发失败会留下 INVALID 索引，每次先清理同名 INVALID 残留再重建
 *  - 单个索引失败不影响其他索引，也不阻塞服务启动
 *
 * 索引依据实际查询模式分析：
 *  - article_metadata(user_id, article_id)：列表/详情 JOIN 的核心条件
 *  - article_metadata(user_id, is_archived, is_favorited)：inbox/favorites/archive 视图过滤与 counts
 *  - article_metadata(user_id, is_published) WHERE is_published：published 部分索引（仅索引已发布行）
 *  - categories(user_id, is_active, sort_order)：归档分类导航和管理列表
 *  - article_metadata(user_id, category_id, is_archived)：分类归档列表和计数
 *  - mcp_request_logs(client_id, created_at DESC)：MCP 限流 COUNT 的时间窗口查询
 *  - collect_jobs(client_id, status)：MCP 并发采集数检查
 */
export async function ensureDatabaseIndexes(): Promise<void> {
  // pg_trgm 扩展支持 ILIKE '%keyword%' 走 GIN trigram 索引（需 superuser，失败则搜索走全表扫描）
  try {
    await db.execute(sql`CREATE EXTENSION IF NOT EXISTS pg_trgm`);
  } catch (error) {
    console.error('[db-indexes] 创建 pg_trgm 扩展失败（搜索将走全表扫描）:', (error as Error).message);
  }

  for (const { name, create } of INDEXES) {
    try {
      // 清理 CONCURRENTLY 失败残留的 INVALID 索引（若有），否则 IF NOT EXISTS 会跳过重建
      const invalid = await db.execute(sql`
        SELECT i.indexrelid::regclass::text AS index_name
        FROM pg_index i
        JOIN pg_class c ON c.oid = i.indexrelid
        WHERE c.relname = ${name} AND NOT i.indisvalid
      `);
      if (invalid.rows.length > 0) {
        await db.execute(sql.raw(`DROP INDEX ${name}`));
      }

      await db.execute(sql.raw(create));
    } catch (error) {
      console.error(`[db-indexes] 创建索引 ${name} 失败:`, (error as Error).message);
    }
  }
}
