import { createHash } from 'crypto';
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  articles,
  articleMetadata,
  wikiArticleExtracts,
  wikiArticles,
  wikiJobs,
  wikiLinks,
  wikiPageSources,
  wikiPageVersions,
  wikiPages,
} from '../db/schema.js';
import { callWikiAI, getWikiAIConfig } from './ai.service.js';
import { getArticleContent } from './reader.service.js';

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
  items?: Array<{ text: string; sources?: number[] }>;
  articleIds?: number[];
  pageIds?: number[];
};

type ArticleExtract = {
  summary: string;
  topics: string[];
  entities: string[];
  facts: WikiFact[];
  suggestedPages: string[];
  sourceQuotes: Array<{ text: string; articleId?: number }>;
};

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
];

let schemaReady = false;
let wikiJobRunnerActive = false;

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
要求：suggestedPages 2-5 个，facts 3-8 条，语言跟随文章。`;
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
  await db.insert(wikiArticles).values({
    articleId,
    status: 'pending',
    updatedAt: new Date(),
  }).onConflictDoUpdate({
    target: wikiArticles.articleId,
    set: { status: 'pending', lastError: null, updatedAt: new Date() },
  });
  await enqueueJob('extract_article', { articleId }, priority);
}

export async function enqueueAllArchivedForWiki() {
  await initWikiSchema();
  const rows = await db
    .select({ id: articles.id })
    .from(articles)
    .innerJoin(articleMetadata, eq(articles.id, articleMetadata.articleId))
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
}

async function getArchivedArticleWithContent(articleId: number) {
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
    .leftJoin(articleMetadata, eq(articles.id, articleMetadata.articleId))
    .where(eq(articles.id, articleId));

  if (!article || !article.isArchived) return null;
  const fetched = await getArticleContent(articleId, 'markdown').catch(() => null);
  const content = fetched || article.contentMarkdown || article.contentHtml || article.summary || article.title || '';
  return { article, content };
}

function pageTypeForTitle(title: string, preferredType?: string) {
  if (preferredType) return preferredType;
  return title.includes('索引') ? 'index' : 'topic';
}

async function upsertPage(title: string, preferredType?: 'topic' | 'concept' | 'index') {
  const slug = slugForTitle(title);
  const [existing] = await db.select().from(wikiPages).where(eq(wikiPages.slug, slug));
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
    .set({ status: 'extracting', lastError: null, updatedAt: new Date() })
    .where(eq(wikiArticles.articleId, articleId));

  let extract: ArticleExtract;
  try {
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

  const topicTitles = (extract.suggestedPages.length ? extract.suggestedPages : fallbackExtract(article, content).suggestedPages).slice(0, 3);
  const sharedEntities = await getSharedEntities(2);
  const conceptTitles = uniq(extract.entities || [], 6).filter((entity) => sharedEntities.has(entity));
  const pageTargets = [
    ...topicTitles.map((title) => ({ title, type: title.includes('索引') ? 'index' as const : 'topic' as const })),
    ...conceptTitles.map((title) => ({ title, type: 'concept' as const })),
  ];

  const pageIds: number[] = [];
  for (const target of pageTargets) {
    const page = await upsertPage(target.title, target.type);
    await attachArticleToPage(page.id, articleId);
    pageIds.push(page.id);
  }
  await syncPageLinks(pageIds);

  await db.update(wikiArticles)
    .set({ status: 'indexed', contentHash: hash, lastIndexedAt: new Date(), updatedAt: new Date() })
    .where(eq(wikiArticles.articleId, articleId));

  for (const pageId of pageIds) {
    await enqueueJob('merge_page', { pageId }, 3);
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
}>): { summary: string; blocks: WikiBlock[] } {
  const articleIds = extracts.map((item) => item.articleId);
  const facts = extracts.flatMap((item) => Array.isArray(item.facts) ? item.facts as WikiFact[] : []);
  const topics = uniq(extracts.flatMap((item) => [...(item.topics || []), ...(item.entities || [])]), 12);
  const summary = extracts[0]?.summary || `本页由 ${extracts.length} 篇归档文章自动整理而成。`;
  const blocks: WikiBlock[] = [
    { id: 'summary', type: 'summary', text: summary },
    { id: 'key-points-heading', type: 'heading', level: 2, text: '核心要点' },
    {
      id: 'key-points',
      type: 'bullet_list',
      items: facts.slice(0, 8).map((fact, index) => ({
        text: fact.claim || String(fact),
        sources: [extracts[index % Math.max(extracts.length, 1)]?.articleId].filter(Boolean),
      })),
    },
    { id: 'concepts-heading', type: 'heading', level: 2, text: '相关概念' },
    { id: 'concepts', type: 'paragraph', text: topics.length ? topics.join('、') : '暂无自动抽取的相关概念。' },
    { id: 'sources-heading', type: 'heading', level: 2, text: '来源文章' },
    { id: 'sources', type: 'source_list', articleIds },
  ];
  return { summary, blocks };
}

async function generatePageWithAI(title: string, extracts: any[]) {
  if (!wikiAIHasApiKey()) return null;
  const system = `你是 Storing 的 Wiki 页面合并器。你只能基于输入的文章抽取结果编写页面。
输出严格 JSON：{"summary":"页面摘要","blocks":[...]}。
blocks 支持：
summary {type:"summary", text}
heading {type:"heading", level, text}
paragraph {type:"paragraph", text}
bullet_list {type:"bullet_list", items:[{text,sources:[articleId]}]}
source_list {type:"source_list", articleIds:[number]}
不要输出无来源事实，语言使用中文。`;
  const user = `Wiki 页面标题：${title}
文章抽取结果：
${JSON.stringify(extracts).slice(0, 18000)}`;
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

  let pageContent: { summary: string; blocks: WikiBlock[] } | null = null;
  try {
    pageContent = await generatePageWithAI(page.title, rows);
  } catch (error: any) {
    console.error(`Wiki page merge fallback for page ${pageId}:`, error.message);
  }
  pageContent ??= buildFallbackPage(page.title, rows);

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
        if (job.jobType === 'extract_article') await extractArticleJob(Number(payload.articleId));
        if (job.jobType === 'merge_page') await mergePageJob(Number(payload.pageId));
        if (job.jobType === 'reconcile_pages') await reconcilePagesJob((payload.pageIds || []).map(Number));
        if (job.jobType === 'rebuild_page') await mergePageJob(Number(payload.pageId));

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
    ) AS source_count
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
  return { pages: pages.rows, pageTypes: pageTypes.rows, jobs, failedJobs, status, recentArticles, meta };
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
    .innerJoin(articleMetadata, eq(articles.id, articleMetadata.articleId))
    .leftJoin(wikiArticleExtracts, eq(wikiArticleExtracts.articleId, articles.id))
    .where(eq(articleMetadata.isArchived, true))
    .orderBy(desc(articleMetadata.archivedAt), desc(wikiArticles.updatedAt))
    .limit(Math.min(Math.max(limit, 1), 30));
}

export async function searchWiki(query: string, limit = 20) {
  await initWikiSchema();
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
    .innerJoin(articleMetadata, eq(articles.id, articleMetadata.articleId))
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
    SELECT DISTINCT p.id, p.title, p.slug, p.page_type, p.summary, p.updated_at
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

  return { ...page, blocks: normalizeBlocks((page.blocks || []) as WikiBlock[]), sources, relatedPages: related.rows };
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
      (SELECT COUNT(*)::int FROM wiki_articles WHERE status IN ('pending', 'extracting', 'stale')) AS pending,
      (SELECT COUNT(*)::int FROM wiki_articles WHERE status = 'failed') AS failed_articles,
      (SELECT COUNT(*)::int FROM wiki_pages WHERE status = 'active') AS pages,
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

export async function rebuildAllWiki(limit = 4) {
  await initWikiSchema();
  await db.update(wikiPages)
    .set({ status: 'inactive', updatedAt: new Date() })
    .where(eq(wikiPages.status, 'active'));
  await db.update(wikiPageSources)
    .set({ active: false, updatedAt: new Date() })
    .where(eq(wikiPageSources.active, true));
  await db.update(wikiJobs)
    .set({ status: 'done', finishedAt: new Date(), updatedAt: new Date() })
    .where(eq(wikiJobs.status, 'pending'));
  await db.update(wikiArticles)
    .set({ status: 'pending', contentHash: null, lastError: null, updatedAt: new Date() })
    .where(sql`${wikiArticles.status} <> 'removed'`);

  const queued = await enqueueAllArchivedForWiki();
  const result = await processWikiJobs(limit);
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
