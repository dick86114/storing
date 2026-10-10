import { sql } from 'drizzle-orm';
import { pgTable, serial, integer, text, boolean, timestamp, jsonb, numeric, uniqueIndex, index } from 'drizzle-orm/pg-core';

/**
 * 用户表 - 存储管理员账号
 */
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: text('role').notNull().default('admin'),
  status: text('status').notNull().default('active'),
  lastLoginAt: timestamp('last_login_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});


/** 可撤销会话表，供原生客户端、浏览器扩展和 Web 共用。 */
export const mobileSessions = pgTable('mobile_sessions', {
  id: text('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  deviceId: text('device_id').notNull(),
  deviceName: text('device_name').notNull(),
  refreshTokenHash: text('refresh_token_hash').notNull().unique(),
  previousRefreshTokenHash: text('previous_refresh_token_hash'),
  rotationGraceUntil: timestamp('rotation_grace_until'),
  rotationCount: integer('rotation_count').notNull().default(0),
  absoluteExpiresAt: timestamp('absolute_expires_at').notNull(),
  appVersion: text('app_version').notNull(),
  clientType: text('client_type').notNull().default('android'),
  createdAt: timestamp('created_at').defaultNow(),
  lastUsedAt: timestamp('last_used_at').defaultNow(),
  expiresAt: timestamp('expires_at').notNull(),
  revokedAt: timestamp('revoked_at'),
});

/**
 * 已有 articles 表的映射（只读，不修改）
 * 对应 weread 数据库中的 articles 表
 */
export const articles = pgTable('articles', {
  id: integer('id').primaryKey(),
  title: text('title'),
  author: text('author'),
  source: text('source'),
  originalUrl: text('original_url'),
  publishTime: timestamp('publish_time'),
  content: jsonb('content'),
  contentMarkdown: text('content_markdown'),
  contentHtml: text('content_html'),
  coverImage: text('cover_image'),
  summary: text('summary'),
  commentary: text('commentary'),
  tags: text('tags').array(),
  readStatus: text('read_status').default('unread'),
  createdAt: timestamp('created_at').defaultNow(),
  readAt: timestamp('read_at'),
  updatedAt: timestamp('updated_at'),
  isFavorite: boolean('is_favorite').default(false),
});

export const mcpClients = pgTable('mcp_clients', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  ownerUserId: integer('owner_user_id').notNull().references(() => users.id),
  apiKeyHash: text('api_key_hash').notNull().unique(),
  scopes: text('scopes').array().notNull().default(sql`ARRAY[]::text[]`),
  enabled: boolean('enabled').notNull().default(true),
  rateLimitPerMinute: integer('rate_limit_per_minute'),
  rateLimitPerDay: integer('rate_limit_per_day'),
  concurrentCollectLimit: integer('concurrent_collect_limit'),
  defaultSaveToInbox: boolean('default_save_to_inbox').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  lastUsedAt: timestamp('last_used_at'),
});

/**
 * MCP 平台级默认配额：普通用户创建 client 时读取此单例设置。
 */
export const mcpPlatformSettings = pgTable('mcp_platform_settings', {
  id: integer('id').primaryKey().default(1),
  rateLimitPerMinute: integer('rate_limit_per_minute').notNull().default(20),
  rateLimitPerDay: integer('rate_limit_per_day').notNull().default(500),
  concurrentCollectLimit: integer('concurrent_collect_limit').notNull().default(3),
  updatedAt: timestamp('updated_at').defaultNow(),
});

/**
 * 我们平台自己的元数据表（读写）
 * 关联 articles 表，存储收藏、归档、AI 生成的内容
 */

export const mcpRequestLogs = pgTable('mcp_request_logs', {
  id: serial('id').primaryKey(),
  clientId: integer('client_id').references(() => mcpClients.id),
  userId: integer('user_id').references(() => users.id),
  toolName: text('tool_name').notNull(),
  url: text('url'),
  normalizedUrl: text('normalized_url'),
  status: text('status').notNull(),
  errorCode: text('error_code'),
  durationMs: integer('duration_ms'),
  transport: text('transport'),
  clientAgent: text('client_agent'),
  requestMethod: text('request_method'),
  requestPath: text('request_path'),
  createdAt: timestamp('created_at').defaultNow(),
});

/** 用户维护的归档主分类。 */
export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  description: text('description'),
  includeExamples: text('include_examples').array().notNull().default(sql`ARRAY[]::text[]`),
  excludeExamples: text('exclude_examples').array().notNull().default(sql`ARRAY[]::text[]`),
  color: text('color'),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  isSystem: boolean('is_system').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export const articleMetadata = pgTable('article_metadata', {
  id: serial('id').primaryKey(),
  articleId: integer('article_id').notNull().references(() => articles.id),
  userId: integer('user_id').notNull().references(() => users.id),
  sourceType: text('source_type').notNull().default('web'),
  clientId: integer('client_id').references(() => mcpClients.id),
  isFavorited: boolean('is_favorited').default(false),
  isArchived: boolean('is_archived').default(false),
  aiSummary: text('ai_summary'),
  aiCategory: text('ai_category'),
  aiTags: text('ai_tags').array(),
  aiStatus: text('ai_status').notNull().default('not_generated'),
  aiErrorCode: text('ai_error_code'),
  aiErrorMessage: text('ai_error_message'),
  aiModel: text('ai_model'),
  aiTotalTokens: integer('ai_total_tokens'),
  aiContentTruncated: boolean('ai_content_truncated').notNull().default(false),
  categoryId: integer('category_id').references(() => categories.id, { onDelete: 'restrict' }),
  categorySource: text('category_source'),
  categoryConfidence: numeric('category_confidence', { precision: 4, scale: 3 }),
  categoryReason: text('category_reason'),
  categoryReviewStatus: text('category_review_status'),
  categoryModelVersion: text('category_model_version'),
  contentMd: text('content_md'),
  contentHtml: text('content_html'),
  contentHtmlMobile: text('content_html_mobile'),
  coverImage: text('cover_image'),
  coverVersion: integer('cover_version').notNull().default(0),
  favoritedAt: timestamp('favorited_at'),
  archivedAt: timestamp('archived_at'),
  isPublished: boolean('is_published').default(false),
  isDeleted: boolean('is_deleted').default(false),
  publishedAt: timestamp('published_at'),
  publicId: text('public_id').unique(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});


export const collectJobs = pgTable('collect_jobs', {
  id: serial('id').primaryKey(),
  url: text('url').notNull(),
  normalizedUrl: text('normalized_url').notNull(),
  userId: integer('user_id').references(() => users.id),
  clientId: integer('client_id').references(() => mcpClients.id),
  requestSource: text('request_source').notNull().default('web'),
  saveToInbox: boolean('save_to_inbox').notNull().default(true),
  ownerDeleted: boolean('owner_deleted').notNull().default(false),
  status: text('status').notNull().default('pending'),
  stage: text('stage').notNull().default('queued'),
  method: text('method').notNull().default('singlefile'),
  captureStrategy: text('capture_strategy'),
  articleId: integer('article_id').references(() => articles.id),
  title: text('title'),
  resultJson: jsonb('result_json'),
  error: text('error'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  startedAt: timestamp('started_at'),
  finishedAt: timestamp('finished_at'),
});

/** 微信转发导入队列：请求只负责保存原始包，耗时解析和上图床由后台处理。 */
export const wechatImportJobs = pgTable('wechat_import_jobs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  requestSource: text('request_source').notNull().default('android'),
  status: text('status').notNull().default('pending'),
  stage: text('stage').notNull().default('queued'),
  storageDir: text('storage_dir').notNull(),
  payload: jsonb('payload').notNull(),
  attempts: integer('attempts').notNull().default(0),
  articleId: integer('article_id').references(() => articles.id),
  title: text('title'),
  messageCount: integer('message_count'),
  mediaCount: integer('media_count'),
  uploadedMediaCount: integer('uploaded_media_count'),
  error: text('error'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  startedAt: timestamp('started_at'),
  finishedAt: timestamp('finished_at'),
}, (table) => [
  index('wechat_import_jobs_user_created_idx').on(table.userId, table.createdAt),
  index('wechat_import_jobs_status_idx').on(table.status, table.id),
]);

/** Durable audit history for privileged cross-user library administration. */
export const adminAuditLogs = pgTable('admin_audit_logs', {
  id: serial('id').primaryKey(),
  actorUserId: integer('actor_user_id').notNull().references(() => users.id),
  targetUserId: integer('target_user_id').references(() => users.id),
  articleId: integer('article_id').references(() => articles.id),
  action: text('action').notNull(),
  detail: jsonb('detail'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
});

/** 每个用户独立保存的大模型接入配置，API Key 只以 AES-256-GCM 密文落库。 */
export const userAiSettings = pgTable('user_ai_settings', {
  userId: integer('user_id').primaryKey().references(() => users.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(),
  model: text('model').notNull(),
  baseUrl: text('base_url'),
  apiKeyCiphertext: text('api_key_ciphertext'),
  apiKeyLast4: text('api_key_last4'),
  apiKeyUpdatedAt: timestamp('api_key_updated_at'),
  autoTriggerOnArchive: boolean('auto_trigger_on_archive').notNull().default(false),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

/** 用户级 AI 生成任务队列，每次使用创建时的模型配置快照。 */
export const aiGenerationJobs = pgTable('ai_generation_jobs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  articleId: integer('article_id').notNull().references(() => articles.id, { onDelete: 'cascade' }),
  triggerType: text('trigger_type').notNull(),
  status: text('status').notNull().default('queued'),
  providerSnapshot: text('provider_snapshot').notNull(),
  modelSnapshot: text('model_snapshot').notNull(),
  baseUrlSnapshot: text('base_url_snapshot'),
  includeCategory: boolean('include_category').notNull().default(true),
  errorCode: text('error_code'),
  errorMessage: text('error_message'),
  attempts: integer('attempts').notNull().default(0),
  promptTokens: integer('prompt_tokens'),
  completionTokens: integer('completion_tokens'),
  totalTokens: integer('total_tokens'),
  contentTruncated: boolean('content_truncated').notNull().default(false),
  nextRunAt: timestamp('next_run_at'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  startedAt: timestamp('started_at'),
  finishedAt: timestamp('finished_at'),
}, (table) => [
  uniqueIndex('ai_generation_jobs_user_article_active_idx')
    .on(table.userId, table.articleId)
    .where(sql`status IN ('queued', 'running')`),
  index('ai_generation_jobs_user_created_idx').on(table.userId, table.createdAt),
  index('ai_generation_jobs_status_idx').on(table.status, table.createdAt),
]);

/** 批量导出任务：文件保留在服务端私有目录，到期后随记录一起清理。 */
export const bulkExportJobs = pgTable('bulk_export_jobs', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  format: text('format').notNull(),
  status: text('status').notNull().default('queued'),
  requestedCount: integer('requested_count').notNull(),
  articleIds: jsonb('article_ids').notNull(),
  includeAi: boolean('include_ai').notNull().default(true),
  organizeByCategory: boolean('organize_by_category').notNull().default(true),
  succeededCount: integer('succeeded_count').notNull().default(0),
  failedCount: integer('failed_count').notNull().default(0),
  failureDetail: jsonb('failure_detail'),
  filePath: text('file_path').notNull(),
  fileName: text('file_name').notNull(),
  fileSize: integer('file_size'),
  errorMessage: text('error_message'),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  finishedAt: timestamp('finished_at'),
}, (table) => [
  index('bulk_export_jobs_user_created_idx').on(table.userId, table.createdAt),
  index('bulk_export_jobs_expires_idx').on(table.expiresAt),
]);
