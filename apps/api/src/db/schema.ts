import { pgTable, serial, integer, text, boolean, timestamp, jsonb } from 'drizzle-orm/pg-core';

/**
 * 用户表 - 存储管理员账号
 */
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
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

/**
 * 我们平台自己的元数据表（读写）
 * 关联 articles 表，存储收藏、归档、AI 生成的内容
 */
export const articleMetadata = pgTable('article_metadata', {
  id: serial('id').primaryKey(),
  articleId: integer('article_id').notNull().unique().references(() => articles.id),
  isFavorited: boolean('is_favorited').default(false),
  isArchived: boolean('is_archived').default(false),
  aiSummary: text('ai_summary'),
  aiCategory: text('ai_category'),
  aiTags: text('ai_tags').array(),
  contentMd: text('content_md'),
  contentHtml: text('content_html'),
  contentHtmlMobile: text('content_html_mobile'),
  coverImage: text('cover_image'),
  favoritedAt: timestamp('favorited_at'),
  archivedAt: timestamp('archived_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const collectJobs = pgTable('collect_jobs', {
  id: serial('id').primaryKey(),
  url: text('url').notNull(),
  normalizedUrl: text('normalized_url').notNull(),
  status: text('status').notNull().default('pending'),
  stage: text('stage').notNull().default('queued'),
  method: text('method').notNull().default('singlefile'),
  captureStrategy: text('capture_strategy'),
  articleId: integer('article_id').references(() => articles.id),
  title: text('title'),
  error: text('error'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  startedAt: timestamp('started_at'),
  finishedAt: timestamp('finished_at'),
});

export const wikiArticles = pgTable('wiki_articles', {
  id: serial('id').primaryKey(),
  articleId: integer('article_id').notNull().unique().references(() => articles.id),
  status: text('status').notNull().default('pending'),
  contentHash: text('content_hash'),
  lastIndexedAt: timestamp('last_indexed_at'),
  lastError: text('last_error'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const wikiArticleExtracts = pgTable('wiki_article_extracts', {
  id: serial('id').primaryKey(),
  articleId: integer('article_id').notNull().unique().references(() => articles.id),
  modelProvider: text('model_provider'),
  modelName: text('model_name'),
  summary: text('summary'),
  topics: text('topics').array(),
  entities: text('entities').array(),
  facts: jsonb('facts'),
  suggestedPages: text('suggested_pages').array(),
  sourceQuotes: jsonb('source_quotes'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const wikiPages = pgTable('wiki_pages', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  pageType: text('page_type').notNull().default('topic'),
  summary: text('summary'),
  blocks: jsonb('blocks'),
  status: text('status').notNull().default('active'),
  version: integer('version').notNull().default(1),
  lastGeneratedAt: timestamp('last_generated_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const wikiPageSources = pgTable('wiki_page_sources', {
  id: serial('id').primaryKey(),
  pageId: integer('page_id').notNull().references(() => wikiPages.id),
  articleId: integer('article_id').notNull().references(() => articles.id),
  contributionType: text('contribution_type').notNull().default('source'),
  sourceBlockIds: text('source_block_ids').array(),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const wikiSourceChunks = pgTable('wiki_source_chunks', {
  id: serial('id').primaryKey(),
  articleId: integer('article_id').notNull().references(() => articles.id),
  chunkKey: text('chunk_key').notNull(),
  heading: text('heading'),
  content: text('content').notNull(),
  contentHash: text('content_hash'),
  ordinal: integer('ordinal').notNull().default(0),
  metadata: jsonb('metadata'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const wikiClaims = pgTable('wiki_claims', {
  id: serial('id').primaryKey(),
  articleId: integer('article_id').notNull().references(() => articles.id),
  chunkId: integer('chunk_id').references(() => wikiSourceChunks.id),
  claim: text('claim').notNull(),
  evidence: text('evidence'),
  topics: text('topics').array(),
  entities: text('entities').array(),
  confidence: integer('confidence').notNull().default(70),
  status: text('status').notNull().default('active'),
  relationType: text('relation_type').notNull().default('supports'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const wikiPageClaims = pgTable('wiki_page_claims', {
  id: serial('id').primaryKey(),
  pageId: integer('page_id').notNull().references(() => wikiPages.id),
  claimId: integer('claim_id').notNull().references(() => wikiClaims.id),
  relevance: integer('relevance').notNull().default(80),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const wikiLinks = pgTable('wiki_links', {
  id: serial('id').primaryKey(),
  fromPageId: integer('from_page_id').notNull().references(() => wikiPages.id),
  toPageId: integer('to_page_id').notNull().references(() => wikiPages.id),
  linkType: text('link_type').notNull().default('related'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const wikiPageVersions = pgTable('wiki_page_versions', {
  id: serial('id').primaryKey(),
  pageId: integer('page_id').notNull().references(() => wikiPages.id),
  version: integer('version').notNull(),
  summary: text('summary'),
  blocks: jsonb('blocks'),
  sourceArticleIds: integer('source_article_ids').array(),
  modelProvider: text('model_provider'),
  modelName: text('model_name'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const wikiJobs = pgTable('wiki_jobs', {
  id: serial('id').primaryKey(),
  jobType: text('job_type').notNull(),
  status: text('status').notNull().default('pending'),
  payload: jsonb('payload'),
  priority: integer('priority').notNull().default(0),
  attempts: integer('attempts').notNull().default(0),
  maxAttempts: integer('max_attempts').notNull().default(3),
  lastError: text('last_error'),
  scheduledAt: timestamp('scheduled_at').defaultNow(),
  startedAt: timestamp('started_at'),
  finishedAt: timestamp('finished_at'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const wikiLogEntries = pgTable('wiki_log_entries', {
  id: serial('id').primaryKey(),
  eventType: text('event_type').notNull(),
  title: text('title').notNull(),
  details: text('details'),
  articleId: integer('article_id').references(() => articles.id),
  pageId: integer('page_id').references(() => wikiPages.id),
  payload: jsonb('payload'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const wikiLintFindings = pgTable('wiki_lint_findings', {
  id: serial('id').primaryKey(),
  findingType: text('finding_type').notNull(),
  severity: text('severity').notNull().default('info'),
  title: text('title').notNull(),
  details: text('details'),
  pageId: integer('page_id').references(() => wikiPages.id),
  articleId: integer('article_id').references(() => articles.id),
  status: text('status').notNull().default('open'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const wikiEmbeddings = pgTable('wiki_embeddings', {
  id: serial('id').primaryKey(),
  targetType: text('target_type').notNull(),
  targetId: text('target_id').notNull(),
  pageId: integer('page_id').references(() => wikiPages.id),
  blockId: text('block_id'),
  articleId: integer('article_id').references(() => articles.id),
  embedding: jsonb('embedding'),
  text: text('text'),
  metadata: jsonb('metadata'),
  createdAt: timestamp('created_at').defaultNow(),
});

export const wikiAnswers = pgTable('wiki_answers', {
  id: serial('id').primaryKey(),
  question: text('question').notNull(),
  answer: text('answer').notNull(),
  citations: jsonb('citations'),
  sourcePageIds: integer('source_page_ids').array(),
  sourceArticleIds: integer('source_article_ids').array(),
  modelProvider: text('model_provider'),
  modelName: text('model_name'),
  status: text('status').notNull().default('answered'),
  filedPageId: integer('filed_page_id').references(() => wikiPages.id),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
