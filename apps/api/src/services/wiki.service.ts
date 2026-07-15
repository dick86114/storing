import { createHash } from 'crypto';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  articles,
  articleMetadata,
  wikiArticleExtracts,
  wikiArticles,
  wikiAnswers,
  wikiClaims,
  wikiJobs,
  wikiLinks,
  wikiLintFindings,
  wikiLogEntries,
  wikiPageClaims,
  wikiPageSources,
  wikiPageVersions,
  wikiPages,
  wikiSourceChunks,
} from '../db/schema.js';
import { callWikiAI, getWikiAIConfig } from './ai.service.js';
import { getArticleContent } from './reader.service.js';
import { getAdminUserId } from './metadata-scope.service.js';

type WikiFact = {
  claim: string;
  evidence?: string;
  confidence?: number;
};

type WikiBlock = {
  id: string;
  type: 'summary' | 'heading' | 'paragraph' | 'bullet_list' | 'source_list' | 'related_pages' | 'callout';
  text?: string;
  level?: number;
  items?: Array<{ text: string; sources?: number[]; claims?: number[] }>;
  articleIds?: number[];
  pageIds?: number[];
  claims?: number[];
};

type ArticleExtract = {
  summary: string;
  topics: string[];
  entities: string[];
  facts: WikiFact[];
  suggestedPages: string[];
  sourceQuotes: Array<{ text: string; articleId?: number }>;
};

type WikiAskCitation = {
  id: string;
  type: 'page' | 'claim' | 'chunk';
  title: string;
  excerpt?: string;
  pageId?: number;
  slug?: string;
  articleId?: number;
  articleTitle?: string;
  claimId?: number;
  chunkId?: number;
};

type WikiPageTarget = { title: string; type: 'topic' | 'concept' | 'index' };

const WIKI_TABLE_SQL = [
  `CREATE TABLE IF NOT EXISTS wiki_articles (
    id SERIAL PRIMARY KEY,
    article_id INTEGER NOT NULL UNIQUE REFERENCES articles(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending',
    content_hash TEXT,
    last_indexed_at TIMESTAMP,
    last_error TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS wiki_article_extracts (
    id SERIAL PRIMARY KEY,
    article_id INTEGER NOT NULL UNIQUE REFERENCES articles(id) ON DELETE CASCADE,
    model_provider TEXT,
    model_name TEXT,
    summary TEXT,
    topics TEXT[],
    entities TEXT[],
    facts JSONB,
    suggested_pages TEXT[],
    source_quotes JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS wiki_pages (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    page_type TEXT NOT NULL DEFAULT 'topic',
    summary TEXT,
    blocks JSONB,
    status TEXT NOT NULL DEFAULT 'active',
    version INTEGER NOT NULL DEFAULT 1,
    last_generated_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS wiki_page_sources (
    id SERIAL PRIMARY KEY,
    page_id INTEGER NOT NULL REFERENCES wiki_pages(id) ON DELETE CASCADE,
    article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    contribution_type TEXT NOT NULL DEFAULT 'source',
    source_block_ids TEXT[],
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS wiki_page_sources_unique_active ON wiki_page_sources(page_id, article_id)`,
  `CREATE TABLE IF NOT EXISTS wiki_source_chunks (
    id SERIAL PRIMARY KEY,
    article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    chunk_key TEXT NOT NULL,
    heading TEXT,
    content TEXT NOT NULL,
    content_hash TEXT,
    ordinal INTEGER NOT NULL DEFAULT 0,
    metadata JSONB,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS wiki_source_chunks_article_key_unique ON wiki_source_chunks(article_id, chunk_key)`,
  `CREATE TABLE IF NOT EXISTS wiki_claims (
    id SERIAL PRIMARY KEY,
    article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    chunk_id INTEGER REFERENCES wiki_source_chunks(id) ON DELETE SET NULL,
    claim TEXT NOT NULL,
    evidence TEXT,
    topics TEXT[],
    entities TEXT[],
    confidence INTEGER NOT NULL DEFAULT 70,
    status TEXT NOT NULL DEFAULT 'active',
    relation_type TEXT NOT NULL DEFAULT 'supports',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS wiki_claims_article_status_idx ON wiki_claims(article_id, status)`,
  `CREATE TABLE IF NOT EXISTS wiki_page_claims (
    id SERIAL PRIMARY KEY,
    page_id INTEGER NOT NULL REFERENCES wiki_pages(id) ON DELETE CASCADE,
    claim_id INTEGER NOT NULL REFERENCES wiki_claims(id) ON DELETE CASCADE,
    relevance INTEGER NOT NULL DEFAULT 80,
    active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS wiki_page_claims_unique_active ON wiki_page_claims(page_id, claim_id)`,
  `CREATE TABLE IF NOT EXISTS wiki_links (
    id SERIAL PRIMARY KEY,
    from_page_id INTEGER NOT NULL REFERENCES wiki_pages(id) ON DELETE CASCADE,
    to_page_id INTEGER NOT NULL REFERENCES wiki_pages(id) ON DELETE CASCADE,
    link_type TEXT NOT NULL DEFAULT 'related',
    created_at TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS wiki_links_unique_pair ON wiki_links(from_page_id, to_page_id, link_type)`,
  `CREATE TABLE IF NOT EXISTS wiki_page_versions (
    id SERIAL PRIMARY KEY,
    page_id INTEGER NOT NULL REFERENCES wiki_pages(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    summary TEXT,
    blocks JSONB,
    source_article_ids INTEGER[],
    model_provider TEXT,
    model_name TEXT,
    created_at TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS wiki_jobs (
    id SERIAL PRIMARY KEY,
    job_type TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    payload JSONB,
    priority INTEGER NOT NULL DEFAULT 0,
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    last_error TEXT,
    scheduled_at TIMESTAMP DEFAULT NOW(),
    started_at TIMESTAMP,
    finished_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS wiki_log_entries (
    id SERIAL PRIMARY KEY,
    event_type TEXT NOT NULL,
    title TEXT NOT NULL,
    details TEXT,
    article_id INTEGER REFERENCES articles(id) ON DELETE SET NULL,
    page_id INTEGER REFERENCES wiki_pages(id) ON DELETE SET NULL,
    payload JSONB,
    created_at TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS wiki_log_entries_created_idx ON wiki_log_entries(created_at DESC)`,
  `CREATE TABLE IF NOT EXISTS wiki_lint_findings (
    id SERIAL PRIMARY KEY,
    finding_type TEXT NOT NULL,
    severity TEXT NOT NULL DEFAULT 'info',
    title TEXT NOT NULL,
    details TEXT,
    page_id INTEGER REFERENCES wiki_pages(id) ON DELETE SET NULL,
    article_id INTEGER REFERENCES articles(id) ON DELETE SET NULL,
    status TEXT NOT NULL DEFAULT 'open',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS wiki_lint_findings_status_idx ON wiki_lint_findings(status, severity)`,
  `CREATE TABLE IF NOT EXISTS wiki_embeddings (
    id SERIAL PRIMARY KEY,
    target_type TEXT NOT NULL,
    target_id TEXT NOT NULL,
    page_id INTEGER REFERENCES wiki_pages(id) ON DELETE CASCADE,
    block_id TEXT,
    article_id INTEGER REFERENCES articles(id) ON DELETE CASCADE,
    embedding JSONB,
    text TEXT,
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE TABLE IF NOT EXISTS wiki_answers (
    id SERIAL PRIMARY KEY,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    citations JSONB,
    source_page_ids INTEGER[],
    source_article_ids INTEGER[],
    model_provider TEXT,
    model_name TEXT,
    status TEXT NOT NULL DEFAULT 'answered',
    filed_page_id INTEGER REFERENCES wiki_pages(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`,
  `CREATE INDEX IF NOT EXISTS wiki_answers_created_idx ON wiki_answers(created_at DESC)`,
];

let schemaReady = false;
let wikiJobRunnerActive = false;

function adminMetadataJoinCondition(adminUserId: number) {
  return and(eq(articles.id, articleMetadata.articleId), eq(articleMetadata.userId, adminUserId));
}

export async function initWikiSchema() {
  if (schemaReady) return;
  for (const statement of WIKI_TABLE_SQL) {
    await db.execute(sql.raw(statement));
  }
  schemaReady = true;
}

function wikiAIHasApiKey() {
  const provider = getWikiAIConfig().provider;
  const keyByProvider: Record<string, string> = {
    anthropic: 'ANTHROPIC_API_KEY',
    deepseek: 'DEEPSEEK_API_KEY',
    zhipu: 'ZHIPU_API_KEY',
    minimax: 'MINIMAX_API_KEY',
    kimi: 'KIMI_API_KEY',
    doubao: 'DOUBAO_API_KEY',
    openrouter: 'OPENROUTER_API_KEY',
    nvidia: 'NVIDIA_API_KEY',
    aliyun: 'ALIYUN_API_KEY',
    siliconflow: 'SILICONFLOW_API_KEY',
    custom: 'CUSTOM_AI_API_KEY',
  };
  const envKey = keyByProvider[provider];
  return Boolean(envKey && process.env[envKey]);
}

function contentHash(input: string) {
  return createHash('sha256').update(input).digest('hex');
}

function slugForTitle(title: string) {
  const ascii = title
    .toLowerCase()
    .replace(/['"`]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
  if (ascii) return ascii;
  return `wiki-${contentHash(title).slice(0, 10)}`;
}

function uniq(values: Array<string | null | undefined>, limit = 12) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    const normalized = String(value || '').trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
    if (result.length >= limit) break;
  }
  return result;
}

function parseJSONPayload(raw: string) {
  const cleaned = raw
    .trim()
    .replace(/^```json\s*/i, '')
    .replace(/^```\s*/i, '')
    .replace(/```$/i, '')
    .trim();
  return JSON.parse(cleaned);
}

function asArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item || '').trim()).filter(Boolean) : [];
}

function normalizeWikiTitle(value: string | null | undefined) {
  return String(value || '')
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[《》「」『』【】[\]（）()：:，,。.!！?？、/\\_\-—~·`'"“”‘’]/g, '')
    .trim();
}

function isWeakDerivedTitle(title: string) {
  const normalized = normalizeWikiTitle(title);
  return /(指南|教程|攻略|大全|推荐|实践|方案|配置|部署指南|部署教程|使用教程|应用部署)$/.test(normalized);
}

function textContainsTerm(text: string | null | undefined, term: string | null | undefined) {
  const normalizedText = normalizeWikiTitle(text);
  const normalizedTerm = normalizeWikiTitle(term);
  return Boolean(normalizedText && normalizedTerm && normalizedText.includes(normalizedTerm));
}

function termMatchesAny(term: string, values: Array<string | null | undefined>) {
  const normalizedTerm = normalizeWikiTitle(term);
  if (!normalizedTerm) return false;
  return values.some((value) => {
    const normalizedValue = normalizeWikiTitle(value);
    return Boolean(normalizedValue && (normalizedValue === normalizedTerm || normalizedValue.includes(normalizedTerm) || normalizedTerm.includes(normalizedValue)));
  });
}

function clampConfidence(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 70;
  if (numeric <= 1) return Math.round(Math.max(0, Math.min(1, numeric)) * 100);
  return Math.round(Math.max(0, Math.min(100, numeric)));
}

async function appendWikiLog(eventType: string, title: string, options: {
  details?: string;
  articleId?: number;
  pageId?: number;
  payload?: Record<string, unknown>;
} = {}) {
  await db.insert(wikiLogEntries).values({
    eventType,
    title,
    details: options.details,
    articleId: options.articleId,
    pageId: options.pageId,
    payload: options.payload,
  });
}

type SourceChunkInput = {
  chunkKey: string;
  heading?: string | null;
  content: string;
  ordinal: number;
  metadata?: Record<string, unknown>;
};

function buildSourceChunks(article: { title: string | null }, content: string): SourceChunkInput[] {
  const normalized = content.replace(/\r\n/g, '\n').trim();
  const lines = normalized.split('\n');
  const chunks: SourceChunkInput[] = [];
  let heading = article.title || '正文';
  let buffer: string[] = [];
  let ordinal = 0;

  const flush = () => {
    const text = buffer.join('\n').trim();
    if (!text) return;
    const pieces = text.length > 1800
      ? text.match(/[\s\S]{1,1600}(?:\s+|$)/g)?.map((part) => part.trim()).filter(Boolean) || [text]
      : [text];
    for (const piece of pieces) {
      chunks.push({
        chunkKey: `chunk-${ordinal + 1}`,
        heading,
        content: piece,
        ordinal,
        metadata: { length: piece.length },
      });
      ordinal += 1;
    }
    buffer = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      flush();
      heading = headingMatch[2].trim();
      continue;
    }
    if (!trimmed && buffer.join('\n').length > 500) {
      flush();
      continue;
    }
    buffer.push(line);
  }
  flush();

  if (chunks.length === 0) {
    const fallback = normalized || article.title || '空白来源';
    chunks.push({
      chunkKey: 'chunk-1',
      heading: article.title || '正文',
      content: fallback.slice(0, 1800),
      ordinal: 0,
      metadata: { length: fallback.length },
    });
  }

  return chunks.slice(0, 80);
}

async function replaceArticleChunks(article: { id: number; title: string | null }, content: string) {
  await db.update(wikiSourceChunks)
    .set({ active: false, updatedAt: new Date() })
    .where(eq(wikiSourceChunks.articleId, article.id));
  await db.update(wikiClaims)
    .set({ status: 'inactive', updatedAt: new Date() })
    .where(eq(wikiClaims.articleId, article.id));

  const chunkInputs = buildSourceChunks(article, content);
  const chunks = [];
  for (const chunk of chunkInputs) {
    const [row] = await db.insert(wikiSourceChunks).values({
      articleId: article.id,
      chunkKey: chunk.chunkKey,
      heading: chunk.heading,
      content: chunk.content,
      contentHash: contentHash(chunk.content),
      ordinal: chunk.ordinal,
      metadata: chunk.metadata,
      active: true,
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: [wikiSourceChunks.articleId, wikiSourceChunks.chunkKey],
      set: {
        heading: chunk.heading,
        content: chunk.content,
        contentHash: contentHash(chunk.content),
        ordinal: chunk.ordinal,
        metadata: chunk.metadata,
        active: true,
        updatedAt: new Date(),
      },
    }).returning();
    chunks.push(row);
  }
  return chunks;
}

function bestChunkForFact(chunks: Array<{ id: number; content: string }>, fact: WikiFact) {
  const evidence = String(fact.evidence || fact.claim || '').slice(0, 80).trim();
  if (evidence) {
    const found = chunks.find((chunk) => chunk.content.includes(evidence));
    if (found) return found;
  }
  return chunks[0];
}

async function replaceArticleClaims(articleId: number, extract: ArticleExtract, chunks: Array<{ id: number; content: string }>) {
  await db.update(wikiClaims)
    .set({ status: 'inactive', updatedAt: new Date() })
    .where(eq(wikiClaims.articleId, articleId));

  const facts = extract.facts.length ? extract.facts : [{ claim: extract.summary, evidence: extract.summary, confidence: 0.65 }];
  const claimRows = [];
  for (const fact of facts.slice(0, 16)) {
    const text = String(fact.claim || '').trim();
    if (!text) continue;
    const chunk = bestChunkForFact(chunks, fact);
    const [row] = await db.insert(wikiClaims).values({
      articleId,
      chunkId: chunk?.id,
      claim: text,
      evidence: fact.evidence,
      topics: extract.topics,
      entities: extract.entities,
      confidence: clampConfidence(fact.confidence),
      status: 'active',
      relationType: 'supports',
      updatedAt: new Date(),
    }).returning();
    claimRows.push(row);
  }
  return claimRows;
}

function fallbackExtract(article: {
  id: number;
  title: string | null;
  source: string | null;
  summary: string | null;
  tags: string[] | null;
}, content: string): ArticleExtract {
  const title = article.title || '未命名文章';
  const plain = content.replace(/[#>*_\-[\]()`]/g, '').replace(/\s+/g, ' ').trim();
  const excerpt = plain.slice(0, 220) || article.summary || title;
  const tags = article.tags || [];
  const source = article.source || '资料索引';
  const suggestedPages = uniq([source, ...tags.slice(0, 2), '资料索引'], 4);
  return {
    summary: article.summary || excerpt,
    topics: uniq([source, ...tags], 8),
    entities: uniq(tags, 8),
    facts: [
      {
        claim: excerpt,
        evidence: excerpt,
        confidence: 0.62,
      },
    ],
    suggestedPages,
    sourceQuotes: [{ text: excerpt, articleId: article.id }],
  };
}

async function generateExtractWithAI(article: {
  id: number;
  title: string | null;
  source: string | null;
  summary: string | null;
  tags: string[] | null;
}, content: string): Promise<ArticleExtract> {
  if (!wikiAIHasApiKey()) return fallbackExtract(article, content);

  const system = `你是 Storing 的 Wiki 编译器。你只能基于给定文章内容抽取知识，不允许补充外部事实。
请输出严格 JSON，不要 Markdown，不要解释。字段：
{
  "summary": "文章级摘要",
  "topics": ["主题"],
  "entities": ["概念或实体"],
  "facts": [{"claim":"事实或结论","evidence":"原文证据短句","confidence":0.0到1.0}],
  "suggestedPages": ["建议更新的 Wiki 页面标题"],
  "sourceQuotes": [{"text":"可引用原文短句"}]
}
要求：
- suggestedPages 1-3 个，只写最值得维护的长期 Wiki 页面。
- 优先使用产品名、项目名、技术名、明确概念名，例如 MonkeyCode、Obsidian、Docker Compose。
- 不要把应用场景、文章写法或泛化动作单独变成页面，例如“家庭服务器部署指南”“使用教程”“配置方案”“实践经验”。
- 如果文章只围绕一个核心实体，suggestedPages 只返回这个核心实体。
- facts 3-8 条，语言跟随文章。`;
  const user = `标题：${article.title || ''}
来源：${article.source || ''}
摘要：${article.summary || ''}
标签：${(article.tags || []).join(', ')}

正文：
${content.slice(0, 14000)}`;

  const raw = await callWikiAI(system, user, 2400);
  const parsed = parseJSONPayload(raw);
  return {
    summary: String(parsed.summary || article.summary || article.title || ''),
    topics: uniq(Array.isArray(parsed.topics) ? parsed.topics : [], 10),
    entities: uniq(Array.isArray(parsed.entities) ? parsed.entities : [], 10),
    facts: Array.isArray(parsed.facts) ? parsed.facts.slice(0, 12) : [],
    suggestedPages: uniq(Array.isArray(parsed.suggestedPages) ? parsed.suggestedPages : [], 5),
    sourceQuotes: Array.isArray(parsed.sourceQuotes) ? parsed.sourceQuotes.slice(0, 8) : [],
  };
}

async function enqueueJob(jobType: string, payload: Record<string, unknown>, priority = 0) {
  await initWikiSchema();
  await db.insert(wikiJobs).values({
    jobType,
    payload,
    priority,
    status: 'pending',
    updatedAt: new Date(),
  });
}

export async function enqueueArticleForWiki(articleId: number, priority = 5) {
  await initWikiSchema();
  const adminUserId = await getAdminUserId();
  const [adminArchived] = await db
    .select({ id: articleMetadata.id })
    .from(articleMetadata)
    .where(and(
      eq(articleMetadata.articleId, articleId),
      eq(articleMetadata.userId, adminUserId),
      eq(articleMetadata.isArchived, true)
    ))
    .limit(1);

  if (!adminArchived) return;

  await db.insert(wikiArticles).values({
    articleId,
    status: 'pending',
    updatedAt: new Date(),
  }).onConflictDoUpdate({
    target: wikiArticles.articleId,
    set: { status: 'pending', lastError: null, updatedAt: new Date() },
  });
  await enqueueJob('chunk_article', { articleId, stage: 'raw_to_claims' }, priority);
}

export async function enqueueAllArchivedForWiki() {
  await initWikiSchema();
  const adminUserId = await getAdminUserId();
  const rows = await db
    .select({ id: articles.id })
    .from(articles)
    .innerJoin(articleMetadata, adminMetadataJoinCondition(adminUserId))
    .where(eq(articleMetadata.isArchived, true));

  for (const row of rows) {
    await enqueueArticleForWiki(row.id, 1);
  }

  return rows.length;
}

export async function removeArticleFromWiki(articleId: number) {
  await initWikiSchema();
  await db.update(wikiArticles)
    .set({ status: 'removed', updatedAt: new Date() })
    .where(eq(wikiArticles.articleId, articleId));
  await db.update(wikiSourceChunks)
    .set({ active: false, updatedAt: new Date() })
    .where(eq(wikiSourceChunks.articleId, articleId));
  await db.update(wikiClaims)
    .set({ status: 'inactive', updatedAt: new Date() })
    .where(eq(wikiClaims.articleId, articleId));

  const affected = await db
    .select({ pageId: wikiPageSources.pageId })
    .from(wikiPageSources)
    .where(and(eq(wikiPageSources.articleId, articleId), eq(wikiPageSources.active, true)));

  await db.update(wikiPageSources)
    .set({ active: false, updatedAt: new Date() })
    .where(eq(wikiPageSources.articleId, articleId));

  const pageIds = uniq(affected.map((row) => String(row.pageId))).map(Number);
  if (pageIds.length > 0) {
    await enqueueJob('reconcile_pages', { pageIds, removedArticleId: articleId }, 10);
  }
  await appendWikiLog('source_removed', '来源已移出 Wiki', {
    articleId,
    details: `文章 #${articleId} 已取消归档或删除，相关贡献已失效。`,
    payload: { affectedPageIds: pageIds },
  });
}

async function getArchivedArticleWithContent(articleId: number) {
  const adminUserId = await getAdminUserId();
  const [article] = await db
    .select({
      id: articles.id,
      title: articles.title,
      source: articles.source,
      summary: articles.summary,
      tags: articles.tags,
      contentMarkdown: articles.contentMarkdown,
      contentHtml: articles.contentHtml,
      isArchived: articleMetadata.isArchived,
    })
    .from(articles)
    .innerJoin(articleMetadata, adminMetadataJoinCondition(adminUserId))
    .where(eq(articles.id, articleId));

  if (!article || !article.isArchived) return null;
  const fetched = await getArticleContent(articleId, 'markdown', 'desktop', adminUserId).catch(() => null);
  const content = fetched || article.contentMarkdown || article.contentHtml || article.summary || article.title || '';
  return { article, content };
}

function pageTypeForTitle(title: string, preferredType?: string) {
  if (preferredType) return preferredType;
  return title.includes('索引') ? 'index' : 'topic';
}

async function upsertPage(title: string, preferredType?: 'topic' | 'concept' | 'index' | 'analysis') {
  let slug = slugForTitle(title);
  let [existing] = await db.select().from(wikiPages).where(eq(wikiPages.slug, slug));
  if (existing && existing.title !== title) {
    slug = `${slug}-${contentHash(title).slice(0, 8)}`;
    [existing] = await db.select().from(wikiPages).where(eq(wikiPages.slug, slug));
  }
  if (existing) {
    if (preferredType && existing.pageType !== preferredType) {
      const [updated] = await db.update(wikiPages)
        .set({ pageType: preferredType, updatedAt: new Date() })
        .where(eq(wikiPages.id, existing.id))
        .returning();
      return updated;
    }
    return existing;
  }
  const [created] = await db.insert(wikiPages).values({
    title,
    slug,
    pageType: pageTypeForTitle(title, preferredType),
    blocks: [],
    status: 'active',
    updatedAt: new Date(),
  }).returning();
  return created;
}

async function attachArticleToPage(pageId: number, articleId: number) {
  await db.execute(sql`
    INSERT INTO wiki_page_sources (page_id, article_id, contribution_type, active, updated_at)
    VALUES (${pageId}, ${articleId}, 'source', true, NOW())
    ON CONFLICT (page_id, article_id)
    DO UPDATE SET active = true, updated_at = NOW()
  `);
}

async function attachClaimsToPage(pageId: number, claimIds: number[]) {
  const ids = [...new Set(claimIds.filter((id) => Number.isFinite(id)))].slice(0, 80);
  if (ids.length === 0) return;
  for (const claimId of ids) {
    await db.execute(sql`
      INSERT INTO wiki_page_claims (page_id, claim_id, relevance, active, updated_at)
      VALUES (${pageId}, ${claimId}, 80, true, NOW())
      ON CONFLICT (page_id, claim_id)
      DO UPDATE SET active = true, updated_at = NOW()
    `);
  }
}

async function getSharedEntities(minSources = 2) {
  const rows = await db.execute(sql`
    SELECT entity
    FROM (
      SELECT trim(entity_value) AS entity, COUNT(DISTINCT e.article_id)::int AS source_count
      FROM wiki_article_extracts e
      INNER JOIN article_metadata m ON m.article_id = e.article_id
      CROSS JOIN LATERAL unnest(e.entities) AS entity_value
      WHERE m.is_archived = true
        AND trim(entity_value) <> ''
      GROUP BY trim(entity_value)
    ) ranked
    WHERE source_count >= ${minSources}
  `);
  return new Set(rows.rows.map((row: any) => String(row.entity)));
}

async function getExistingPageTitleSet() {
  const rows = await db.select({ title: wikiPages.title }).from(wikiPages).where(eq(wikiPages.status, 'active'));
  return new Set(rows.map((row) => normalizeWikiTitle(row.title)));
}

function scorePageTarget(title: string, extract: ArticleExtract, article: { title: string | null; source: string | null }) {
  const normalizedTitle = normalizeWikiTitle(title);
  if (!normalizedTitle || normalizedTitle.length < 2) return -20;

  let score = 0;
  const exactEntity = extract.entities.some((entity) => normalizeWikiTitle(entity) === normalizedTitle);
  const exactTopic = extract.topics.some((topic) => normalizeWikiTitle(topic) === normalizedTitle);

  if (exactEntity) score += 10;
  else if (termMatchesAny(title, extract.entities)) score += 5;

  if (exactTopic) score += 5;
  else if (termMatchesAny(title, extract.topics)) score += 2;

  if (normalizeWikiTitle(extract.suggestedPages[0]) === normalizedTitle) score += 8;
  if (textContainsTerm(article.title, title)) score += 8;
  if (textContainsTerm(article.source, title)) score += 2;

  if (isWeakDerivedTitle(title) && !exactEntity) score -= 6;
  if (!termMatchesAny(title, [...extract.entities, ...extract.topics]) && !textContainsTerm(article.title, title)) score -= 6;

  return score;
}

function claimMatchesPageTitle(title: string, claim: { claim: string; evidence?: string | null; topics?: string[] | null; entities?: string[] | null }) {
  if (termMatchesAny(title, claim.entities || [])) return true;
  if (termMatchesAny(title, claim.topics || [])) return true;
  if (textContainsTerm(claim.claim, title) || textContainsTerm(claim.evidence, title)) return true;
  return false;
}

function claimIdsForPageTitle(title: string, claims: Array<{ id: number; claim: string; evidence?: string | null; topics?: string[] | null; entities?: string[] | null }>) {
  const matched = claims.filter((claim) => claimMatchesPageTitle(title, claim)).map((claim) => claim.id);
  return matched.length ? matched : claims.map((claim) => claim.id);
}

async function selectPageTargets(extract: ArticleExtract, article: { title: string | null; source: string | null }): Promise<WikiPageTarget[]> {
  const sharedEntities = await getSharedEntities(2);
  const existingPages = await getExistingPageTitleSet();
  const candidates = uniq([
    ...extract.suggestedPages,
    ...extract.entities,
    ...extract.topics,
  ], 24);

  const ranked = candidates
    .map((title) => {
      const score = scorePageTarget(title, extract, article);
      const normalized = normalizeWikiTitle(title);
      const shared = extract.entities.some((entity) => normalizeWikiTitle(entity) === normalized && sharedEntities.has(entity));
      const existing = existingPages.has(normalized);
      const exactEntity = extract.entities.some((entity) => normalizeWikiTitle(entity) === normalized);
      return { title, normalized, score, shared, existing, exactEntity };
    })
    .filter((item) => item.score >= 4 || item.shared || item.existing)
    .sort((a, b) => {
      if (a.exactEntity !== b.exactEntity) return a.exactEntity ? -1 : 1;
      if (a.score !== b.score) return b.score - a.score;
      if (a.shared !== b.shared) return a.shared ? -1 : 1;
      if (a.existing !== b.existing) return a.existing ? -1 : 1;
      return 0;
    });

  const selected: WikiPageTarget[] = [];
  for (const item of ranked) {
    if (selected.some((target) => normalizeWikiTitle(target.title) === item.normalized)) continue;
    if (selected.length > 0 && !item.shared && !item.existing) continue;
    const type: WikiPageTarget['type'] = item.shared && item.exactEntity ? 'concept' : item.title.includes('索引') ? 'index' : 'topic';
    selected.push({ title: item.title, type });
    if (selected.length >= 2) break;
  }

  if (selected.length > 0) return selected;

  const fallbackTitle = extract.entities[0] || extract.topics[0] || article.source || '资料索引';
  const fallbackType: WikiPageTarget['type'] = fallbackTitle.includes('索引') ? 'index' : 'topic';
  return [{ title: fallbackTitle, type: fallbackType }];
}

async function syncPageLinks(pageIds: number[]) {
  const ids = [...new Set(pageIds.filter((id) => Number.isFinite(id)))];
  if (ids.length < 2) return;
  for (const fromPageId of ids) {
    for (const toPageId of ids) {
      if (fromPageId === toPageId) continue;
      await db.insert(wikiLinks).values({
        fromPageId,
        toPageId,
        linkType: 'shared_source',
      }).onConflictDoNothing();
    }
  }
}

async function extractArticleJob(articleId: number) {
  const record = await getArchivedArticleWithContent(articleId);
  if (!record) {
    await removeArticleFromWiki(articleId);
    return;
  }

  const { article, content } = record;
  const hash = contentHash(`${article.title || ''}\n${article.summary || ''}\n${content}`);
  const [existing] = await db
    .select({ contentHash: wikiArticles.contentHash, status: wikiArticles.status })
    .from(wikiArticles)
    .where(eq(wikiArticles.articleId, articleId));

  if (existing?.contentHash === hash && existing.status === 'indexed') return;

  await db.update(wikiArticles)
    .set({ status: 'chunking', lastError: null, updatedAt: new Date() })
    .where(eq(wikiArticles.articleId, articleId));

  const chunks = await replaceArticleChunks(article, content);

  let extract: ArticleExtract;
  try {
    await db.update(wikiArticles)
      .set({ status: 'extracting', lastError: null, updatedAt: new Date() })
      .where(eq(wikiArticles.articleId, articleId));
    extract = await generateExtractWithAI(article, content);
  } catch (error: any) {
    extract = fallbackExtract(article, content);
    console.error(`Wiki extract fallback for article ${articleId}:`, error.message);
  }

  if (extract.suggestedPages.length === 0) {
    extract.suggestedPages = fallbackExtract(article, content).suggestedPages;
  }

  const config = getWikiAIConfig();
  await db.insert(wikiArticleExtracts).values({
    articleId,
    modelProvider: config.provider,
    modelName: config.model,
    summary: extract.summary,
    topics: extract.topics,
    entities: extract.entities,
    facts: extract.facts,
    suggestedPages: extract.suggestedPages,
    sourceQuotes: extract.sourceQuotes,
    updatedAt: new Date(),
  }).onConflictDoUpdate({
    target: wikiArticleExtracts.articleId,
    set: {
      modelProvider: config.provider,
      modelName: config.model,
      summary: extract.summary,
      topics: extract.topics,
      entities: extract.entities,
      facts: extract.facts,
      suggestedPages: extract.suggestedPages,
      sourceQuotes: extract.sourceQuotes,
      updatedAt: new Date(),
    },
  });

  const claims = await replaceArticleClaims(articleId, extract, chunks);
  const previousPages = await db
    .select({ pageId: wikiPageSources.pageId })
    .from(wikiPageSources)
    .where(and(eq(wikiPageSources.articleId, articleId), eq(wikiPageSources.active, true)));
  await db.update(wikiPageSources)
    .set({ active: false, updatedAt: new Date() })
    .where(eq(wikiPageSources.articleId, articleId));
  await db.execute(sql`
    UPDATE wiki_page_claims pc
    SET active = false, updated_at = NOW()
    FROM wiki_claims c
    WHERE pc.claim_id = c.id AND c.article_id = ${articleId}
  `);
  await appendWikiLog('ingest', `编译来源：${article.title || `文章 #${articleId}`}`, {
    articleId,
    details: `生成 ${chunks.length} 个原文块、${claims.length} 条知识声明。`,
    payload: {
      topics: extract.topics,
      entities: extract.entities,
      suggestedPages: extract.suggestedPages,
    },
  });

  const pageTargets = await selectPageTargets(extract, article);

  const pageIds: number[] = [];
  const claimsByPageId = new Map<number, number[]>();
  for (const target of pageTargets) {
    const page = await upsertPage(target.title, target.type);
    await attachArticleToPage(page.id, articleId);
    pageIds.push(page.id);
    claimsByPageId.set(page.id, claimIdsForPageTitle(target.title, claims));
  }
  await syncPageLinks(pageIds);

  await db.update(wikiArticles)
    .set({ status: 'indexed', contentHash: hash, lastIndexedAt: new Date(), updatedAt: new Date() })
    .where(eq(wikiArticles.articleId, articleId));

  for (const pageId of pageIds) {
    await attachClaimsToPage(pageId, claimsByPageId.get(pageId) || claims.map((claim) => claim.id));
    await enqueueJob('merge_page', { pageId }, 3);
  }
  const stalePageIds = previousPages
    .map((row) => row.pageId)
    .filter((pageId) => !pageIds.includes(pageId));
  if (stalePageIds.length > 0) {
    await enqueueJob('reconcile_pages', { pageIds: stalePageIds, articleId, reason: 'article_targets_changed' }, 2);
  }
}

function buildFallbackPage(title: string, extracts: Array<{
  articleId: number;
  articleTitle: string | null;
  source: string | null;
  summary: string | null;
  topics: string[] | null;
  entities: string[] | null;
  facts: unknown;
}>, claims: Array<{
  id: number;
  articleId: number;
  claim: string;
  evidence: string | null;
  topics: string[] | null;
  entities: string[] | null;
}> = []): { summary: string; blocks: WikiBlock[] } {
  const articleIds = extracts.map((item) => item.articleId);
  const facts = extracts.flatMap((item) => Array.isArray(item.facts) ? item.facts as WikiFact[] : []);
  const topics = uniq(extracts.flatMap((item) => [...(item.topics || []), ...(item.entities || [])]), 12);
  const summary = extracts[0]?.summary || `本页由 ${extracts.length} 篇归档文章自动整理而成。`;
  const claimItems = claims.length
    ? claims.slice(0, 10).map((claim) => ({
      text: claim.claim,
      sources: [claim.articleId],
      claims: [claim.id],
    }))
    : facts.slice(0, 8).map((fact, index) => ({
      text: fact.claim || String(fact),
      sources: [extracts[index % Math.max(extracts.length, 1)]?.articleId].filter(Boolean),
    }));
  const blocks: WikiBlock[] = [
    { id: 'summary', type: 'summary', text: summary },
    { id: 'key-points-heading', type: 'heading', level: 2, text: '核心要点' },
    {
      id: 'key-points',
      type: 'bullet_list',
      items: claimItems,
    },
    { id: 'concepts-heading', type: 'heading', level: 2, text: '相关概念' },
    { id: 'concepts', type: 'paragraph', text: topics.length ? topics.join('、') : '暂无自动抽取的相关概念。' },
    { id: 'sources-heading', type: 'heading', level: 2, text: '来源文章' },
    { id: 'sources', type: 'source_list', articleIds },
  ];
  return { summary, blocks };
}

async function generatePageWithAI(title: string, extracts: any[], claims: any[]) {
  if (!wikiAIHasApiKey()) return null;
  const system = `你是 Storing 的 Wiki 维护者。你维护的是一个长期积累的知识库，而不是单篇文章摘要。
你只能基于输入的文章抽取结果与 claims 编写页面。遇到多篇文章交叉支持的内容，要综合成稳定结论；来源不足或可能冲突的内容要谨慎表述。
输出严格 JSON：{"summary":"页面摘要","blocks":[...]}。
blocks 支持：
summary {type:"summary", text}
heading {type:"heading", level, text}
paragraph {type:"paragraph", text}
bullet_list {type:"bullet_list", items:[{text,sources:[articleId],claims:[claimId]}]}
source_list {type:"source_list", articleIds:[number]}
不要输出无来源事实。每个核心要点必须带 sources，能对应 claim 时带 claims。语言使用中文。`;
  const user = `Wiki 页面标题：${title}
文章抽取结果：
${JSON.stringify(extracts).slice(0, 12000)}

可引用 claims：
${JSON.stringify(claims).slice(0, 12000)}`;
  const raw = await callWikiAI(system, user, 3000);
  const parsed = parseJSONPayload(raw);
  if (!parsed?.summary || !Array.isArray(parsed.blocks)) return null;
  return parsed as { summary: string; blocks: WikiBlock[] };
}

async function mergePageJob(pageId: number) {
  const [page] = await db.select().from(wikiPages).where(eq(wikiPages.id, pageId));
  if (!page) return;

  const rows = await db
    .select({
      articleId: articles.id,
      articleTitle: articles.title,
      source: articles.source,
      summary: wikiArticleExtracts.summary,
      topics: wikiArticleExtracts.topics,
      entities: wikiArticleExtracts.entities,
      facts: wikiArticleExtracts.facts,
      suggestedPages: wikiArticleExtracts.suggestedPages,
    })
    .from(wikiPageSources)
    .innerJoin(articles, eq(wikiPageSources.articleId, articles.id))
    .leftJoin(wikiArticleExtracts, eq(wikiPageSources.articleId, wikiArticleExtracts.articleId))
    .where(and(eq(wikiPageSources.pageId, pageId), eq(wikiPageSources.active, true)));

  if (rows.length === 0) {
    await db.update(wikiPages)
      .set({ status: 'inactive', updatedAt: new Date() })
      .where(eq(wikiPages.id, pageId));
    return;
  }

  const articleIds = rows.map((row) => row.articleId);
  let claimsResult = await db.execute(sql`
      SELECT c.id, c.article_id AS "articleId", c.claim, c.evidence, c.topics, c.entities, c.confidence, c.relation_type AS "relationType",
             ch.heading, ch.ordinal AS chunk_ordinal
      FROM wiki_page_claims pc
      INNER JOIN wiki_claims c ON c.id = pc.claim_id
      LEFT JOIN wiki_source_chunks ch ON ch.id = c.chunk_id
      WHERE pc.page_id = ${pageId}
        AND pc.active = true
        AND c.status = 'active'
      ORDER BY pc.relevance DESC, c.confidence DESC, c.updated_at DESC
      LIMIT 80
    `);
  if (claimsResult.rows.length === 0 && articleIds.length) {
    claimsResult = await db.execute(sql`
      SELECT c.id, c.article_id AS "articleId", c.claim, c.evidence, c.topics, c.entities, c.confidence, c.relation_type AS "relationType",
             ch.heading, ch.ordinal AS chunk_ordinal
      FROM wiki_claims c
      LEFT JOIN wiki_source_chunks ch ON ch.id = c.chunk_id
      WHERE c.status = 'active'
        AND c.article_id IN (${sql.join(articleIds.map((id) => sql`${id}`), sql`, `)})
      ORDER BY c.confidence DESC, c.updated_at DESC
      LIMIT 80
    `);
  }
  const claims = claimsResult.rows as any[];

  let pageContent: { summary: string; blocks: WikiBlock[] } | null = null;
  try {
    pageContent = await generatePageWithAI(page.title, rows, claims);
  } catch (error: any) {
    console.error(`Wiki page merge fallback for page ${pageId}:`, error.message);
  }
  pageContent ??= buildFallbackPage(page.title, rows, claims);

  const nextVersion = (page.version || 0) + 1;
  const normalizedBlocks = normalizeBlocks(pageContent.blocks);
  const config = getWikiAIConfig();
  await db.update(wikiPages).set({
    summary: pageContent.summary,
    blocks: normalizedBlocks,
    status: 'active',
    version: nextVersion,
    lastGeneratedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(wikiPages.id, pageId));

  await db.insert(wikiPageVersions).values({
    pageId,
    version: nextVersion,
    summary: pageContent.summary,
    blocks: normalizedBlocks,
    sourceArticleIds: rows.map((row) => row.articleId),
    modelProvider: config.provider,
    modelName: config.model,
  });
  await db.update(wikiPageClaims)
    .set({ active: false, updatedAt: new Date() })
    .where(eq(wikiPageClaims.pageId, pageId));
  await attachClaimsToPage(pageId, claims.map((claim: any) => Number(claim.id)));
  await appendWikiLog('page_merged', `更新页面：${page.title}`, {
    pageId,
    details: `合并 ${rows.length} 篇来源文章、${claims.length} 条知识声明，生成 v${nextVersion}。`,
    payload: { sourceArticleIds: rows.map((row) => row.articleId), claimCount: claims.length },
  });
}

function normalizeBlocks(blocks: WikiBlock[]) {
  return blocks.map((block, index) => ({
    ...block,
    id: block.id || `${block.type || 'block'}-${index + 1}`,
  }));
}

async function reconcilePagesJob(pageIds: number[]) {
  for (const pageId of pageIds) {
    await mergePageJob(pageId);
  }
}

export async function processWikiJobs(limit = 5) {
  await initWikiSchema();
  if (wikiJobRunnerActive) {
    return { processed: 0, skipped: true };
  }

  wikiJobRunnerActive = true;
  let processed = 0;
  try {
    while (processed < limit) {
      const [job] = await db
        .select()
        .from(wikiJobs)
        .where(and(eq(wikiJobs.status, 'pending'), sql`${wikiJobs.attempts} < ${wikiJobs.maxAttempts}`))
        .orderBy(desc(wikiJobs.priority), wikiJobs.createdAt)
        .limit(1);
      if (!job) break;

      const attempts = (job.attempts || 0) + 1;
      try {
        await db.update(wikiJobs)
          .set({ status: 'running', attempts, startedAt: new Date(), updatedAt: new Date() })
          .where(eq(wikiJobs.id, job.id));

        const payload = (job.payload || {}) as any;
        if (job.jobType === 'chunk_article' || job.jobType === 'extract_article' || job.jobType === 'extract_claims' || job.jobType === 'plan_pages') {
          await extractArticleJob(Number(payload.articleId));
        }
        if (job.jobType === 'merge_page') await mergePageJob(Number(payload.pageId));
        if (job.jobType === 'reconcile_pages') await reconcilePagesJob((payload.pageIds || []).map(Number));
        if (job.jobType === 'rebuild_page') await mergePageJob(Number(payload.pageId));
        if (job.jobType === 'lint_wiki') await runWikiLint();
        if (job.jobType === 'export_markdown') await buildWikiMarkdownExport();

        await db.update(wikiJobs)
          .set({ status: 'done', finishedAt: new Date(), updatedAt: new Date() })
          .where(eq(wikiJobs.id, job.id));
        processed += 1;
      } catch (error: any) {
        await db.update(wikiJobs)
          .set({
            status: attempts >= (job.maxAttempts || 3) ? 'failed' : 'pending',
            lastError: error.message,
            updatedAt: new Date(),
          })
          .where(eq(wikiJobs.id, job.id));
      }
    }

    if (processed > 0) {
      try {
        await pruneSparseConceptPages();
      } catch (error: any) {
        console.error('Wiki concept pruning skipped:', error.message);
      }
    }

    return { processed };
  } finally {
    wikiJobRunnerActive = false;
  }
}

export function isWikiJobRunnerActive() {
  return wikiJobRunnerActive;
}

export async function pruneSparseConceptPages(minSources = 2) {
  await initWikiSchema();
  await db.execute(sql`
    UPDATE wiki_pages
    SET status = 'inactive', updated_at = NOW()
    WHERE page_type = 'concept'
      AND status = 'active'
      AND id IN (
        SELECT p.id
        FROM wiki_pages p
        LEFT JOIN wiki_page_sources s ON s.page_id = p.id AND s.active = true
        WHERE p.page_type = 'concept'
        GROUP BY p.id
        HAVING COUNT(DISTINCT s.article_id) < ${minSources}
      )
  `);
}

export async function getWikiHome(pageType?: string) {
  await initWikiSchema();
  const typeFilter = pageType && pageType !== 'all'
    ? sql`WHERE status = 'active' AND page_type = ${pageType}`
    : sql`WHERE status = 'active'`;
  const pages = await db.execute(sql`
    SELECT *, (
      SELECT COUNT(*)::int FROM wiki_page_sources s WHERE s.page_id = wiki_pages.id AND s.active = true
    ) AS source_count, (
      SELECT COUNT(*)::int FROM wiki_page_claims pc WHERE pc.page_id = wiki_pages.id AND pc.active = true
    ) AS claim_count
    FROM wiki_pages
    ${typeFilter}
    ORDER BY updated_at DESC
    LIMIT 80
  `);

  const pageTypes = await db.execute(sql`
    SELECT page_type AS type, COUNT(*)::int AS count
    FROM wiki_pages
    WHERE status = 'active'
    GROUP BY page_type
  `);

  const jobs = await getWikiJobs('pending', 6);
  const failedJobs = await getWikiJobs('failed', 6);
  const status = await getWikiStatus();
  const recentArticles = await getRecentWikiArticles(8);
  const meta = await getWikiMeta();
  const log = await getWikiLog(8);
  const lint = await getWikiLintFindings('open', 8);
  return { pages: pages.rows, pageTypes: pageTypes.rows, jobs, failedJobs, status, recentArticles, meta, log: log.entries, lint: lint.findings };
}

export async function getWikiIndex() {
  await initWikiSchema();
  const result = await db.execute(sql`
    SELECT p.id, p.title, p.slug, p.page_type, p.summary, p.version, p.updated_at, p.last_generated_at,
      COUNT(DISTINCT s.article_id)::int AS source_count,
      COUNT(DISTINCT pc.claim_id)::int AS claim_count,
      (SELECT COUNT(*)::int FROM wiki_links l WHERE l.to_page_id = p.id) AS inbound_count,
      (SELECT COUNT(*)::int FROM wiki_links l WHERE l.from_page_id = p.id) AS outbound_count
    FROM wiki_pages p
    LEFT JOIN wiki_page_sources s ON s.page_id = p.id AND s.active = true
    LEFT JOIN wiki_page_claims pc ON pc.page_id = p.id AND pc.active = true
    WHERE p.status = 'active'
    GROUP BY p.id
    ORDER BY p.page_type, source_count DESC, p.updated_at DESC
  `);
  const groups = (result.rows as any[]).reduce((acc, page) => {
    const type = page.page_type || 'topic';
    acc[type] ||= [];
    acc[type].push(page);
    return acc;
  }, {} as Record<string, any[]>);
  return { groups, pages: result.rows };
}

export async function getWikiLog(limit = 50) {
  await initWikiSchema();
  const entries = await db
    .select()
    .from(wikiLogEntries)
    .orderBy(desc(wikiLogEntries.createdAt))
    .limit(Math.min(Math.max(limit, 1), 200));
  return { entries };
}

export async function getWikiLintFindings(status = 'open', limit = 50) {
  await initWikiSchema();
  const findings = await db
    .select()
    .from(wikiLintFindings)
    .where(eq(wikiLintFindings.status, status))
    .orderBy(desc(wikiLintFindings.updatedAt))
    .limit(Math.min(Math.max(limit, 1), 200));
  return { findings };
}

export async function getWikiGraph() {
  await initWikiSchema();
  const pages = await db.execute(sql`
    SELECT id, title, slug, page_type, summary FROM wiki_pages WHERE status = 'active' LIMIT 300
  `);
  const sources = await db.execute(sql`
    SELECT DISTINCT a.id, a.title, a.source
    FROM articles a
    INNER JOIN wiki_page_sources s ON s.article_id = a.id AND s.active = true
    LIMIT 500
  `);
  const pageSourceEdges = await db.execute(sql`
    SELECT page_id, article_id FROM wiki_page_sources WHERE active = true LIMIT 1000
  `);
  const pageLinks = await db.execute(sql`
    SELECT from_page_id, to_page_id, link_type FROM wiki_links LIMIT 1000
  `);
  return {
    nodes: [
      ...(pages.rows as any[]).map((page) => ({ id: `page:${page.id}`, type: 'page', ...page })),
      ...(sources.rows as any[]).map((article) => ({ id: `article:${article.id}`, type: 'article', ...article })),
    ],
    edges: [
      ...(pageSourceEdges.rows as any[]).map((edge) => ({ from: `page:${edge.page_id}`, to: `article:${edge.article_id}`, type: 'source' })),
      ...(pageLinks.rows as any[]).map((edge) => ({ from: `page:${edge.from_page_id}`, to: `page:${edge.to_page_id}`, type: edge.link_type || 'related' })),
    ],
  };
}

export async function getWikiMeta() {
  await initWikiSchema();
  const result = await db.execute(sql`
    SELECT
      (SELECT MAX(updated_at) FROM wiki_pages WHERE status = 'active') AS last_updated_at,
      (SELECT MAX(finished_at) FROM wiki_jobs WHERE status = 'done') AS last_finished_at,
      (SELECT COUNT(*)::int FROM wiki_page_versions) AS versions
  `);
  return {
    ...(result.rows[0] || {}),
    provider: getWikiAIConfig().provider,
    model: getWikiAIConfig().model,
  };
}

export async function getRecentWikiArticles(limit = 8) {
  await initWikiSchema();
  const adminUserId = await getAdminUserId();
  return db
    .select({
      id: articles.id,
      title: articles.title,
      source: articles.source,
      summary: wikiArticleExtracts.summary,
      status: wikiArticles.status,
      lastIndexedAt: wikiArticles.lastIndexedAt,
      archivedAt: articleMetadata.archivedAt,
    })
    .from(wikiArticles)
    .innerJoin(articles, eq(wikiArticles.articleId, articles.id))
    .innerJoin(articleMetadata, adminMetadataJoinCondition(adminUserId))
    .leftJoin(wikiArticleExtracts, eq(wikiArticleExtracts.articleId, articles.id))
    .where(eq(articleMetadata.isArchived, true))
    .orderBy(desc(articleMetadata.archivedAt), desc(wikiArticles.updatedAt))
    .limit(Math.min(Math.max(limit, 1), 30));
}

export async function searchWiki(query: string, limit = 20) {
  await initWikiSchema();
  const adminUserId = await getAdminUserId();
  const q = query.trim();
  if (!q) return { pages: [], articles: [] };
  const pattern = `%${q}%`;
  const pages = await db.execute(sql`
    SELECT *, (
      SELECT COUNT(*)::int FROM wiki_page_sources s WHERE s.page_id = wiki_pages.id AND s.active = true
    ) AS source_count
    FROM wiki_pages
    WHERE status = 'active'
      AND (
        title ILIKE ${pattern}
        OR summary ILIKE ${pattern}
        OR blocks::text ILIKE ${pattern}
      )
    ORDER BY updated_at DESC
    LIMIT ${Math.min(Math.max(limit, 1), 50)}
  `);

  const articlesFound = await db
    .select({
      id: articles.id,
      title: articles.title,
      source: articles.source,
      summary: wikiArticleExtracts.summary,
      status: wikiArticles.status,
    })
    .from(wikiArticles)
    .innerJoin(articles, eq(wikiArticles.articleId, articles.id))
    .innerJoin(articleMetadata, adminMetadataJoinCondition(adminUserId))
    .leftJoin(wikiArticleExtracts, eq(wikiArticleExtracts.articleId, articles.id))
    .where(and(
      eq(articleMetadata.isArchived, true),
      sql`(${articles.title} ILIKE ${pattern} OR ${articles.source} ILIKE ${pattern} OR ${wikiArticleExtracts.summary} ILIKE ${pattern})`
    ))
    .orderBy(desc(wikiArticles.updatedAt))
    .limit(Math.min(Math.max(limit, 1), 50));

  return { pages: pages.rows, articles: articlesFound };
}

export async function getWikiJobs(status = 'pending', limit = 20) {
  await initWikiSchema();
  return db
    .select()
    .from(wikiJobs)
    .where(eq(wikiJobs.status, status))
    .orderBy(desc(wikiJobs.updatedAt))
    .limit(Math.min(Math.max(limit, 1), 100));
}

export async function getWikiPage(slug: string) {
  await initWikiSchema();
  const [page] = await db.select().from(wikiPages).where(eq(wikiPages.slug, slug));
  if (!page) return null;

  const sources = await db
    .select({
      id: articles.id,
      title: articles.title,
      source: articles.source,
      summary: articles.summary,
      publishTime: articles.publishTime,
      originalUrl: articles.originalUrl,
    })
    .from(wikiPageSources)
    .innerJoin(articles, eq(wikiPageSources.articleId, articles.id))
    .where(and(eq(wikiPageSources.pageId, page.id), eq(wikiPageSources.active, true)))
    .orderBy(desc(articles.createdAt));

  const related = await db.execute(sql`
    SELECT DISTINCT p.id, p.title, p.slug, p.page_type, p.summary, p.updated_at,
      CASE
        WHEN p.id IN (SELECT to_page_id FROM wiki_links WHERE from_page_id = ${page.id}) THEN '页面互链'
        ELSE '共享来源文章'
      END AS reason
    FROM wiki_pages p
    WHERE p.status = 'active'
      AND p.id <> ${page.id}
      AND (
        p.id IN (SELECT to_page_id FROM wiki_links WHERE from_page_id = ${page.id})
        OR p.id IN (
          SELECT s2.page_id
          FROM wiki_page_sources s1
          INNER JOIN wiki_page_sources s2 ON s1.article_id = s2.article_id
          WHERE s1.page_id = ${page.id}
            AND s1.active = true
            AND s2.active = true
            AND s2.page_id <> ${page.id}
        )
      )
    ORDER BY p.updated_at DESC
    LIMIT 12
  `);

  const claims = await db.execute(sql`
    SELECT c.id, c.claim, c.evidence, c.confidence, c.relation_type, c.article_id,
           a.title AS article_title, ch.heading, ch.ordinal AS chunk_ordinal
    FROM wiki_page_claims pc
    INNER JOIN wiki_claims c ON c.id = pc.claim_id
    LEFT JOIN articles a ON a.id = c.article_id
    LEFT JOIN wiki_source_chunks ch ON ch.id = c.chunk_id
    WHERE pc.page_id = ${page.id}
      AND pc.active = true
      AND c.status = 'active'
    ORDER BY pc.relevance DESC, c.confidence DESC
    LIMIT 80
  `);

  const versions = await db
    .select({
      id: wikiPageVersions.id,
      version: wikiPageVersions.version,
      summary: wikiPageVersions.summary,
      sourceArticleIds: wikiPageVersions.sourceArticleIds,
      modelProvider: wikiPageVersions.modelProvider,
      modelName: wikiPageVersions.modelName,
      createdAt: wikiPageVersions.createdAt,
    })
    .from(wikiPageVersions)
    .where(eq(wikiPageVersions.pageId, page.id))
    .orderBy(desc(wikiPageVersions.createdAt))
    .limit(8);

  return {
    ...page,
    blocks: normalizeBlocks((page.blocks || []) as WikiBlock[]),
    sources,
    relatedPages: related.rows,
    claims: claims.rows,
    versions,
  };
}

export async function getWikiArticleStatus(articleId: number) {
  await initWikiSchema();
  const [status] = await db.select().from(wikiArticles).where(eq(wikiArticles.articleId, articleId));
  if (!status) return { articleId, status: 'not_indexed', pages: [] };

  const pages = await db
    .select({ id: wikiPages.id, title: wikiPages.title, slug: wikiPages.slug })
    .from(wikiPageSources)
    .innerJoin(wikiPages, eq(wikiPageSources.pageId, wikiPages.id))
    .where(and(eq(wikiPageSources.articleId, articleId), eq(wikiPageSources.active, true)));

  return { ...status, pages };
}

export async function getWikiStatus() {
  await initWikiSchema();
  const result = await db.execute(sql`
    SELECT
      (SELECT COUNT(*)::int FROM articles a INNER JOIN article_metadata m ON a.id = m.article_id WHERE m.is_archived = true) AS archived,
      (SELECT COUNT(*)::int FROM wiki_articles WHERE status = 'indexed') AS indexed,
      (SELECT COUNT(*)::int FROM wiki_articles WHERE status IN ('pending', 'chunking', 'extracting', 'stale')) AS pending,
      (SELECT COUNT(*)::int FROM wiki_articles WHERE status = 'failed') AS failed_articles,
      (SELECT COUNT(*)::int FROM wiki_pages WHERE status = 'active') AS pages,
      (SELECT COUNT(*)::int FROM wiki_source_chunks WHERE active = true) AS chunks,
      (SELECT COUNT(*)::int FROM wiki_claims WHERE status = 'active') AS claims,
      (SELECT COUNT(*)::int FROM wiki_lint_findings WHERE status = 'open') AS lint_findings,
      (SELECT COUNT(*)::int FROM wiki_jobs WHERE status = 'pending') AS pending_jobs,
      (SELECT COUNT(*)::int FROM wiki_jobs WHERE status = 'running') AS running_jobs,
      (SELECT COUNT(*)::int FROM wiki_jobs WHERE status = 'failed') AS failed_jobs
  `);
  return { ...(result.rows[0] || {}), runner_active: isWikiJobRunnerActive() };
}

export async function retryFailedWikiJobs() {
  await initWikiSchema();
  await db.update(wikiJobs)
    .set({ status: 'pending', lastError: null, updatedAt: new Date() })
    .where(eq(wikiJobs.status, 'failed'));
}

export async function runWikiLint() {
  await initWikiSchema();
  await db.update(wikiLintFindings)
    .set({ status: 'resolved', updatedAt: new Date() })
    .where(eq(wikiLintFindings.status, 'open'));

  const lowSourcePages = await db.execute(sql`
    SELECT p.id, p.title, COUNT(DISTINCT s.article_id)::int AS source_count
    FROM wiki_pages p
    LEFT JOIN wiki_page_sources s ON s.page_id = p.id AND s.active = true
    WHERE p.status = 'active'
    GROUP BY p.id
    HAVING COUNT(DISTINCT s.article_id) <= 1
    LIMIT 80
  `);
  for (const page of lowSourcePages.rows as any[]) {
    await db.insert(wikiLintFindings).values({
      findingType: 'low_source_page',
      severity: page.source_count === 0 ? 'warning' : 'info',
      title: `页面来源偏少：${page.title}`,
      details: `当前仅关联 ${page.source_count} 篇来源文章，可能还不是稳定综合页。`,
      pageId: Number(page.id),
      updatedAt: new Date(),
    });
  }

  const uncitedPages = await db.execute(sql`
    SELECT p.id, p.title
    FROM wiki_pages p
    LEFT JOIN wiki_page_claims pc ON pc.page_id = p.id AND pc.active = true
    WHERE p.status = 'active'
    GROUP BY p.id
    HAVING COUNT(pc.claim_id) = 0
    LIMIT 80
  `);
  for (const page of uncitedPages.rows as any[]) {
    await db.insert(wikiLintFindings).values({
      findingType: 'missing_claim_citations',
      severity: 'warning',
      title: `页面缺少 claim 引用：${page.title}`,
      details: '该页面没有绑定可追溯的知识声明，建议重建页面或重新编译来源。',
      pageId: Number(page.id),
      updatedAt: new Date(),
    });
  }

  const failedJobs = await db.execute(sql`
    SELECT COUNT(*)::int AS count FROM wiki_jobs WHERE status = 'failed'
  `);
  const failedCount = Number((failedJobs.rows[0] as any)?.count || 0);
  if (failedCount > 0) {
    await db.insert(wikiLintFindings).values({
      findingType: 'failed_jobs',
      severity: 'error',
      title: `存在 ${failedCount} 个失败任务`,
      details: '失败任务会阻断部分来源进入 Wiki，请在任务面板查看并重试。',
      updatedAt: new Date(),
    });
  }

  const result = await getWikiLintFindings('open', 100);
  await appendWikiLog('lint', '完成 Wiki 健康检查', {
    details: `发现 ${result.findings.length} 个待处理问题。`,
    payload: { findingCount: result.findings.length },
  });
  return result;
}

function yamlScalar(value: unknown) {
  return JSON.stringify(value ?? '');
}

function blockToMarkdown(block: WikiBlock, sourcesById: Map<number, any>, claimsById: Map<number, any>) {
  if (block.type === 'summary') return `> ${block.text || ''}\n`;
  if (block.type === 'heading') return `${'#'.repeat(Math.max(2, block.level || 2))} ${block.text || ''}\n`;
  if (block.type === 'bullet_list') {
    return (block.items || []).map((item) => {
      const sourceText = item.sources?.length
        ? ` 来源：${item.sources.map((id) => sourcesById.get(id)?.title || `#${id}`).join('、')}`
        : '';
      const claimText = item.claims?.length
        ? ` Claims：${item.claims.map((id) => `#${id}:${claimsById.get(id)?.claim || ''}`).join('；')}`
        : '';
      return `- ${item.text}${sourceText}${claimText}`;
    }).join('\n') + '\n';
  }
  if (block.type === 'source_list') {
    return (block.articleIds || []).map((id) => `- [[sources/${id}]] ${sourcesById.get(id)?.title || `来源 #${id}`}`).join('\n') + '\n';
  }
  return `${block.text || ''}\n`;
}

export async function buildWikiMarkdownExport() {
  await initWikiSchema();
  const index = await getWikiIndex();
  const log = await getWikiLog(200);
  const files: Array<{ path: string; content: string }> = [];
  files.push({
    path: 'index.md',
    content: [
      '# Wiki Index',
      '',
      ...Object.entries(index.groups as Record<string, any[]>).flatMap(([type, pages]) => [
        `## ${pageTypeForTitle(type, type) === 'index' ? '资料索引' : pageTypeLabelForExport(type)}`,
        '',
        ...pages.map((page) => `- [[pages/${page.slug}]] ${page.title} - ${page.summary || ''} (${page.source_count} sources)`),
        '',
      ]),
    ].join('\n'),
  });
  files.push({
    path: 'log.md',
    content: [
      '# Wiki Log',
      '',
      ...log.entries.map((entry: any) => `## [${new Date(entry.createdAt || entry.created_at).toISOString()}] ${entry.eventType || entry.event_type} | ${entry.title}\n${entry.details || ''}\n`),
    ].join('\n'),
  });

  for (const page of index.pages as any[]) {
    const detail = await getWikiPage(page.slug);
    if (!detail) continue;
    const sourcesById = new Map<number, any>((detail.sources || []).map((source: any) => [source.id, source]));
    const claimsById = new Map<number, any>((detail.claims || []).map((claim: any) => [claim.id, claim]));
    const frontmatter = [
      '---',
      `title: ${yamlScalar(detail.title)}`,
      `type: ${yamlScalar(detail.pageType)}`,
      `updated_at: ${yamlScalar(detail.updatedAt)}`,
      `source_count: ${(detail.sources || []).length}`,
      `related_pages: [${(detail.relatedPages || []).map((related: any) => yamlScalar(related.title)).join(', ')}]`,
      `claims: [${(detail.claims || []).slice(0, 40).map((claim: any) => claim.id).join(', ')}]`,
      '---',
      '',
    ].join('\n');
    files.push({
      path: `pages/${detail.slug}.md`,
      content: `${frontmatter}# ${detail.title}\n\n${(detail.blocks || []).map((block: WikiBlock) => blockToMarkdown(block, sourcesById, claimsById)).join('\n')}`,
    });
    for (const source of detail.sources || []) {
      files.push({
        path: `sources/${source.id}.md`,
        content: `---\ntitle: ${yamlScalar(source.title)}\nsource: ${yamlScalar(source.source)}\noriginal_url: ${yamlScalar(source.originalUrl)}\n---\n\n# ${source.title}\n\n${source.summary || ''}\n`,
      });
    }
  }

  await appendWikiLog('export', '生成 Markdown 导出', {
    details: `生成 ${files.length} 个 Markdown 文件。`,
    payload: { fileCount: files.length },
  });
  return { generatedAt: new Date().toISOString(), files };
}

export async function buildWikiPageMarkdownExport(slug: string) {
  await initWikiSchema();
  const detail = await getWikiPage(slug);
  if (!detail) return null;

  const sourcesById = new Map<number, any>((detail.sources || []).map((source: any) => [source.id, source]));
  const claimsById = new Map<number, any>((detail.claims || []).map((claim: any) => [claim.id, claim]));
  const frontmatter = [
    '---',
    `title: ${yamlScalar(detail.title)}`,
    `type: ${yamlScalar(detail.pageType)}`,
    `updated_at: ${yamlScalar(detail.updatedAt)}`,
    `source_count: ${(detail.sources || []).length}`,
    `related_pages: [${(detail.relatedPages || []).map((related: any) => yamlScalar(related.title)).join(', ')}]`,
    `claims: [${(detail.claims || []).slice(0, 40).map((claim: any) => claim.id).join(', ')}]`,
    '---',
    '',
  ].join('\n');
  const content = `${frontmatter}# ${detail.title}\n\n${(detail.blocks || [])
    .map((block: WikiBlock) => blockToMarkdown(block, sourcesById, claimsById))
    .join('\n')}`;

  await appendWikiLog('export', `导出 Wiki 页面：${detail.title}`, {
    pageId: detail.id,
    details: `导出单篇 Markdown：${detail.slug}.md。`,
    payload: { slug: detail.slug },
  });

  return {
    generatedAt: new Date().toISOString(),
    filename: `${detail.slug}.md`,
    content,
  };
}

function pageTypeLabelForExport(type: string) {
  if (type === 'analysis') return '分析页';
  if (type === 'concept') return '概念';
  if (type === 'index') return '资料索引';
  return '主题';
}

export async function reconcileWikiClaims() {
  await initWikiSchema();
  const duplicateRows = await db.execute(sql`
    SELECT lower(trim(claim)) AS normalized, COUNT(*)::int AS count
    FROM wiki_claims
    WHERE status = 'active'
    GROUP BY lower(trim(claim))
    HAVING COUNT(*) > 1
  `);
  await appendWikiLog('claims_reconciled', '完成 claims 关系重算', {
    details: `发现 ${duplicateRows.rows.length} 组重复或高度相似的声明。`,
    payload: { duplicateGroups: duplicateRows.rows.length },
  });
  return { duplicateGroups: duplicateRows.rows.length };
}

function questionTerms(question: string) {
  const normalized = question.trim().replace(/\s+/g, ' ');
  const asciiTerms = normalized
    .split(/[^\p{L}\p{N}]+/u)
    .map((term) => term.trim())
    .filter((term) => term.length >= 2);
  return uniq([normalized, ...asciiTerms], 8);
}

function likeClauses(terms: string[], expressions: ReturnType<typeof sql>[]) {
  const patterns = terms.map((term) => `%${term}%`);
  const clauses = patterns.flatMap((pattern) => expressions.map((expression) => sql`${expression} ILIKE ${pattern}`));
  return clauses.length ? sql`(${sql.join(clauses, sql` OR `)})` : sql`TRUE`;
}

async function retrieveWikiAskContext(question: string) {
  await initWikiSchema();
  const terms = questionTerms(question);
  const pageWhere = likeClauses(terms, [sql`p.title`, sql`p.summary`, sql`p.blocks::text`]);
  const claimWhere = likeClauses(terms, [sql`c.claim`, sql`c.evidence`, sql`array_to_string(c.topics, ' ')`, sql`array_to_string(c.entities, ' ')`, sql`a.title`, sql`ch.content`]);
  const chunkWhere = likeClauses(terms, [sql`ch.heading`, sql`ch.content`, sql`a.title`, sql`a.source`]);

  let pages = await db.execute(sql`
    SELECT p.id, p.title, p.slug, p.page_type, p.summary,
      COUNT(DISTINCT s.article_id)::int AS source_count,
      COUNT(DISTINCT pc.claim_id)::int AS claim_count
    FROM wiki_pages p
    LEFT JOIN wiki_page_sources s ON s.page_id = p.id AND s.active = true
    LEFT JOIN wiki_page_claims pc ON pc.page_id = p.id AND pc.active = true
    WHERE p.status = 'active' AND ${pageWhere}
    GROUP BY p.id
    ORDER BY source_count DESC, claim_count DESC, p.updated_at DESC
    LIMIT 8
  `);

  let claims = await db.execute(sql`
    SELECT c.id, c.claim, c.evidence, c.confidence, c.article_id, a.title AS article_title,
      ch.id AS chunk_id, ch.heading, ch.content, ch.ordinal
    FROM wiki_claims c
    LEFT JOIN articles a ON a.id = c.article_id
    LEFT JOIN wiki_source_chunks ch ON ch.id = c.chunk_id
    INNER JOIN article_metadata m ON m.article_id = c.article_id AND m.is_archived = true
    WHERE c.status = 'active' AND ${claimWhere}
    ORDER BY c.confidence DESC, c.updated_at DESC
    LIMIT 18
  `);

  let chunks = await db.execute(sql`
    SELECT ch.id, ch.article_id, ch.heading, ch.content, ch.ordinal, a.title AS article_title, a.source
    FROM wiki_source_chunks ch
    INNER JOIN articles a ON a.id = ch.article_id
    INNER JOIN article_metadata m ON m.article_id = ch.article_id AND m.is_archived = true
    WHERE ch.active = true AND ${chunkWhere}
    ORDER BY ch.ordinal ASC
    LIMIT 10
  `);

  if (pages.rows.length === 0 && claims.rows.length === 0 && chunks.rows.length === 0) {
    pages = await db.execute(sql`
      SELECT p.id, p.title, p.slug, p.page_type, p.summary,
        COUNT(DISTINCT s.article_id)::int AS source_count,
        COUNT(DISTINCT pc.claim_id)::int AS claim_count
      FROM wiki_pages p
      LEFT JOIN wiki_page_sources s ON s.page_id = p.id AND s.active = true
      LEFT JOIN wiki_page_claims pc ON pc.page_id = p.id AND pc.active = true
      WHERE p.status = 'active'
      GROUP BY p.id
      ORDER BY source_count DESC, claim_count DESC, p.updated_at DESC
      LIMIT 6
    `);
    claims = await db.execute(sql`
      SELECT c.id, c.claim, c.evidence, c.confidence, c.article_id, a.title AS article_title,
        ch.id AS chunk_id, ch.heading, ch.content, ch.ordinal
      FROM wiki_claims c
      LEFT JOIN articles a ON a.id = c.article_id
      LEFT JOIN wiki_source_chunks ch ON ch.id = c.chunk_id
      INNER JOIN article_metadata m ON m.article_id = c.article_id AND m.is_archived = true
      WHERE c.status = 'active'
      ORDER BY c.confidence DESC, c.updated_at DESC
      LIMIT 12
    `);
  }

  const citations: WikiAskCitation[] = [
    ...(pages.rows as any[]).map((page, index) => ({
      id: `P${index + 1}`,
      type: 'page' as const,
      title: page.title,
      excerpt: page.summary || '',
      pageId: Number(page.id),
      slug: page.slug,
    })),
    ...(claims.rows as any[]).map((claim, index) => ({
      id: `C${index + 1}`,
      type: 'claim' as const,
      title: claim.article_title || `Claim #${claim.id}`,
      excerpt: claim.claim,
      articleId: Number(claim.article_id),
      articleTitle: claim.article_title,
      claimId: Number(claim.id),
      chunkId: claim.chunk_id ? Number(claim.chunk_id) : undefined,
    })),
    ...(chunks.rows as any[]).map((chunk, index) => ({
      id: `R${index + 1}`,
      type: 'chunk' as const,
      title: chunk.article_title || `Chunk #${chunk.id}`,
      excerpt: String(chunk.content || '').slice(0, 360),
      articleId: Number(chunk.article_id),
      articleTitle: chunk.article_title,
      chunkId: Number(chunk.id),
    })),
  ];

  return {
    pages: pages.rows,
    claims: claims.rows,
    chunks: chunks.rows,
    citations,
  };
}

function fallbackWikiAnswer(question: string, citations: WikiAskCitation[]) {
  if (citations.length === 0) return '当前 Wiki 里还没有足够的归档资料回答这个问题。';
  const points = citations.slice(0, 5).map((citation) => `- ${citation.excerpt || citation.title} [${citation.id}]`);
  return [`基于当前归档知识库，和“${question}”最相关的信息如下：`, '', ...points].join('\n');
}

type WikiAskHistoryItem = {
  question: string;
  answer: string;
};

async function generateWikiAnswer(question: string, citations: WikiAskCitation[], history: WikiAskHistoryItem[] = []) {
  if (!wikiAIHasApiKey()) return fallbackWikiAnswer(question, citations);
  const context = citations.map((citation) => `[${citation.id}] ${citation.type} | ${citation.title}\n${citation.excerpt || ''}`).join('\n\n');
  const conversation = history
    .slice(-5)
    .map((item, index) => `第 ${index + 1} 轮\n用户：${item.question}\n助手：${item.answer}`)
    .join('\n\n');
  const system = `你是 Storing 的知识库问答助手。只能基于提供的 Wiki 上下文回答，不允许编造外部事实。
回答要求：
- 中文回答，清晰、实用。
- 结论后用 [P1]、[C2]、[R3] 这样的引用标记注明来源。
- 如果资料不足，要明确说“不足以确定”，并指出还缺什么资料。
- 如果用户在追问，请结合最近对话理解代词和省略表达，但事实仍必须来自 Wiki 上下文。
- 不要输出 JSON。`;
  const user = `问题：${question}

最近对话：
${conversation || '无'}

Wiki 上下文：
${context.slice(0, 18000)}`;
  return callWikiAI(system, user, 2200);
}

export async function getWikiAnswers(limit = 20) {
  await initWikiSchema();
  return db
    .select()
    .from(wikiAnswers)
    .orderBy(desc(wikiAnswers.createdAt))
    .limit(Math.min(Math.max(limit, 1), 50));
}

export async function deleteWikiAnswer(answerId: number) {
  await initWikiSchema();
  const [deleted] = await db
    .delete(wikiAnswers)
    .where(eq(wikiAnswers.id, answerId))
    .returning({ id: wikiAnswers.id });
  if (!deleted) throw new Error('问答记录不存在。');
  await appendWikiLog('qa_deleted', `删除问答记录 #${answerId}`, {
    details: `answerId=${answerId}`,
    payload: { answerId },
  });
  return { answerId, deleted: true };
}

export async function askWiki(question: string, history: WikiAskHistoryItem[] = []) {
  await initWikiSchema();
  const cleanQuestion = question.trim();
  if (cleanQuestion.length < 2) {
    throw new Error('问题太短，请输入更具体的问题。');
  }
  const storedHistory = await getWikiAnswers(5);
  const mergedHistory = [
    ...storedHistory.reverse().map((item) => ({ question: item.question, answer: item.answer })),
    ...history,
  ].slice(-5);
  const context = await retrieveWikiAskContext(cleanQuestion);
  const answer = await generateWikiAnswer(cleanQuestion, context.citations, mergedHistory);
  const config = getWikiAIConfig();
  const sourcePageIds = [...new Set(context.citations.map((citation) => citation.pageId).filter((id): id is number => Number.isFinite(id)))];
  const sourceArticleIds = [...new Set(context.citations.map((citation) => citation.articleId).filter((id): id is number => Number.isFinite(id)))];
  const [row] = await db.insert(wikiAnswers).values({
    question: cleanQuestion,
    answer,
    citations: context.citations,
    sourcePageIds,
    sourceArticleIds,
    modelProvider: config.provider,
    modelName: config.model,
    updatedAt: new Date(),
  }).returning();
  await appendWikiLog('qa_answered', '知识库问答', {
    details: cleanQuestion,
    payload: { answerId: row.id, citationCount: context.citations.length },
  });
  return { ...row, context: { citations: context.citations } };
}

function answerTitle(question: string) {
  const normalized = question.replace(/[?？。！!]+$/g, '').trim();
  return `问答：${normalized.slice(0, 28) || '知识库分析'}`;
}

export async function fileWikiAnswer(answerId: number) {
  await initWikiSchema();
  const [answer] = await db.select().from(wikiAnswers).where(eq(wikiAnswers.id, answerId));
  if (!answer) throw new Error('问答记录不存在。');

  const title = answerTitle(answer.question);
  const page = await upsertPage(title, 'analysis');
  const citations = (answer.citations || []) as WikiAskCitation[];
  const sourceArticleIds = [...new Set((answer.sourceArticleIds || []).filter((id) => Number.isFinite(id)))];
  for (const articleId of sourceArticleIds) {
    await attachArticleToPage(page.id, articleId);
  }
  const citationItems = citations.slice(0, 12).map((citation) => ({
    text: `${citation.title}${citation.excerpt ? `：${citation.excerpt}` : ''}`,
    sources: citation.articleId ? [citation.articleId] : undefined,
    claims: citation.claimId ? [citation.claimId] : undefined,
  }));
  const citationClaimIds = citations
    .map((citation) => citation.claimId)
    .filter((id): id is number => Number.isFinite(id));
  const blocks: WikiBlock[] = normalizeBlocks([
    { id: 'summary', type: 'summary', text: answer.answer.slice(0, 260) },
    { id: 'question-heading', type: 'heading', level: 2, text: '问题' },
    { id: 'question', type: 'paragraph', text: answer.question },
    { id: 'answer-heading', type: 'heading', level: 2, text: '回答' },
    { id: 'answer', type: 'paragraph', text: answer.answer },
    { id: 'citations-heading', type: 'heading', level: 2, text: '引用依据' },
    { id: 'citations', type: 'bullet_list', items: citationItems },
    { id: 'sources-heading', type: 'heading', level: 2, text: '来源文章' },
    { id: 'sources', type: 'source_list', articleIds: sourceArticleIds },
  ]);
  const nextVersion = (page.version || 0) + 1;
  const config = getWikiAIConfig();
  await db.update(wikiPages).set({
    summary: answer.answer.slice(0, 260),
    blocks,
    status: 'active',
    version: nextVersion,
    lastGeneratedAt: new Date(),
    updatedAt: new Date(),
  }).where(eq(wikiPages.id, page.id));
  await db.insert(wikiPageVersions).values({
    pageId: page.id,
    version: nextVersion,
    summary: answer.answer.slice(0, 260),
    blocks,
    sourceArticleIds,
    modelProvider: config.provider,
    modelName: config.model,
  });
  await db.update(wikiPageClaims)
    .set({ active: false, updatedAt: new Date() })
    .where(eq(wikiPageClaims.pageId, page.id));
  await attachClaimsToPage(page.id, citationClaimIds);
  await db.update(wikiAnswers).set({
    status: 'filed',
    filedPageId: page.id,
    updatedAt: new Date(),
  }).where(eq(wikiAnswers.id, answerId));
  await appendWikiLog('qa_filed', `沉淀问答：${title}`, {
    pageId: page.id,
    details: answer.question,
    payload: { answerId, sourceArticleIds },
  });
  return { answerId, pageId: page.id, slug: page.slug, title };
}

export async function rebuildAllWiki(limit = 4) {
  await initWikiSchema();
  await db.update(wikiPages)
    .set({ status: 'inactive', updatedAt: new Date() })
    .where(eq(wikiPages.status, 'active'));
  await db.update(wikiPageSources)
    .set({ active: false, updatedAt: new Date() })
    .where(eq(wikiPageSources.active, true));
  await db.update(wikiPageClaims)
    .set({ active: false, updatedAt: new Date() })
    .where(eq(wikiPageClaims.active, true));
  await db.update(wikiSourceChunks)
    .set({ active: false, updatedAt: new Date() })
    .where(eq(wikiSourceChunks.active, true));
  await db.update(wikiClaims)
    .set({ status: 'inactive', updatedAt: new Date() })
    .where(eq(wikiClaims.status, 'active'));
  await db.update(wikiJobs)
    .set({ status: 'done', finishedAt: new Date(), updatedAt: new Date() })
    .where(eq(wikiJobs.status, 'pending'));
  await db.update(wikiArticles)
    .set({ status: 'pending', contentHash: null, lastError: null, updatedAt: new Date() })
    .where(sql`${wikiArticles.status} <> 'removed'`);

  const queued = await enqueueAllArchivedForWiki();
  const result = await processWikiJobs(limit);
  await appendWikiLog('rebuild', '全量重建 Wiki', {
    details: `已重新排队 ${queued} 篇归档文章。`,
    payload: { queued },
  });
  return { queued, ...result };
}

export async function enqueuePageRebuild(pageId: number) {
  await enqueueJob('rebuild_page', { pageId }, 8);
}

export async function enqueueArticlePagesRebuild(articleId: number) {
  const pageRows = await db
    .select({ pageId: wikiPageSources.pageId })
    .from(wikiPageSources)
    .where(eq(wikiPageSources.articleId, articleId));
  const pageIds = pageRows.map((row) => row.pageId);
  if (pageIds.length > 0) await enqueueJob('reconcile_pages', { pageIds }, 7);
}
