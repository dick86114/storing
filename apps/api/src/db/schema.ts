import { sql } from 'drizzle-orm';
import { pgTable, serial, integer, text, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core';

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


/** Revocable device sessions used by native and browser-extension clients. */
export const mobileSessions = pgTable('mobile_sessions', {
  id: text('id').primaryKey(),
  userId: integer('user_id').notNull().references(() => users.id),
  deviceId: text('device_id').notNull(),
  deviceName: text('device_name').notNull(),
  refreshTokenHash: text('refresh_token_hash').notNull().unique(),
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
