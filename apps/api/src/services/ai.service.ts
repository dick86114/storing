import Anthropic from '@anthropic-ai/sdk';
import { db } from '../db/index.js';
import { articles, articleMetadata } from '../db/schema.js';
import { eq } from 'drizzle-orm';
import { fetchArticleContentFromSources, getArticleContent } from './reader.service.js';

/** 预置 provider 配置：env 中只需写 AI_PROVIDER + 对应 API_KEY + 可选 MODEL */
const PROVIDERS: Record<string, { baseUrl: string; defaultModel: string; envKey: string }> = {
  deepseek:   { baseUrl: 'https://api.deepseek.com/v1',                  defaultModel: 'deepseek-v4-flash',     envKey: 'DEEPSEEK_API_KEY' },
  zhipu:      { baseUrl: 'https://open.bigmodel.cn/api/paas/v4',         defaultModel: 'glm-4-flash',            envKey: 'ZHIPU_API_KEY' },
  minimax:    { baseUrl: 'https://api.minimax.chat/v1',                   defaultModel: 'MiniMax-Text-01',        envKey: 'MINIMAX_API_KEY' },
  kimi:       { baseUrl: 'https://api.moonshot.cn/v1',                    defaultModel: 'moonshot-v1-8k',         envKey: 'KIMI_API_KEY' },
  doubao:     { baseUrl: 'https://ark.cn-beijing.volces.com/api/v3',     defaultModel: 'doubao-pro-32k',         envKey: 'DOUBAO_API_KEY' },
  openrouter: { baseUrl: 'https://openrouter.ai/api/v1',                 defaultModel: 'anthropic/claude-haiku-4-5-20251001', envKey: 'OPENROUTER_API_KEY' },
  nvidia:     { baseUrl: 'https://integrate.api.nvidia.com/v1',          defaultModel: 'meta/llama-3.1-8b-instruct',        envKey: 'NVIDIA_API_KEY' },
  aliyun:     { baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', defaultModel: 'qwen-plus',       envKey: 'ALIYUN_API_KEY' },
  siliconflow:{ baseUrl: 'https://api.siliconflow.cn/v1',                defaultModel: 'Qwen/Qwen2.5-7B-Instruct',         envKey: 'SILICONFLOW_API_KEY' },
};

type AIProviderOptions = {
  provider?: string;
  model?: string;
};

export type ArticleSummaryResult = {
  summary: string | null;
  category: string | null;
  tags: string[];
};

// 统一 AI 调用接口
async function callAI(system: string, user: string, maxTokens = 1024, options: AIProviderOptions = {}): Promise<string> {
  const provider = options.provider || process.env.AI_PROVIDER || 'anthropic';

  if (provider === 'anthropic') {
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY || '' });
    const message = await anthropic.messages.create({
      model: options.model || process.env.AI_MODEL || 'claude-haiku-4-5-20251001',
      max_tokens: maxTokens,
      system,
      messages: [{ role: 'user', content: user }],
    });
    const block = message.content[0];
    return block.type === 'text' ? block.text : '';
  }

  if (provider === 'custom') {
    return callOpenAICompatible(
      process.env.CUSTOM_AI_BASE_URL || '',
      process.env.CUSTOM_AI_API_KEY || '',
      options.model || process.env.CUSTOM_AI_MODEL || 'gpt-4o-mini',
      system, user, maxTokens,
    );
  }

  const preset = PROVIDERS[provider];
  if (!preset) {
    throw new Error(`Unknown AI provider: ${provider}. Supported: ${Object.keys(PROVIDERS).join(', ')}, anthropic, custom`);
  }

  const apiKey = process.env[preset.envKey] || '';
  const model = options.model || process.env.AI_MODEL || preset.defaultModel;

  return callOpenAICompatible(preset.baseUrl, apiKey, model, system, user, maxTokens);
}

export function getWikiAIConfig() {
  const provider = process.env.WIKI_AI_PROVIDER || process.env.AI_PROVIDER || 'deepseek';
  const preset = PROVIDERS[provider];
  return {
    provider,
    model: process.env.WIKI_AI_MODEL || process.env.AI_MODEL || preset?.defaultModel || 'deepseek-v4-flash',
  };
}

export async function callWikiAI(system: string, user: string, maxTokens = 2048): Promise<string> {
  const config = getWikiAIConfig();
  return callAI(system, user, maxTokens, config);
}

async function callOpenAICompatible(
  baseUrl: string,
  apiKey: string,
  model: string,
  system: string,
  user: string,
  maxTokens: number,
): Promise<string> {
  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI API error (${res.status}): ${text}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || '';
}

async function generateDigestText(title: string, content: string): Promise<string> {
  const system = `你是一位专业的文章分析师。请对文章进行深度分析，生成一段简洁的智能摘要。

请直接输出摘要内容，不要添加任何 HTML 标签或格式标记。

要求：
- 使用与文章相同的语言
- 3-5 句话概括全文核心内容
- 突出文章的关键信息和价值
- 简洁有力，不要泛泛而谈`;

  const user = `文章标题：${title}

文章内容：
${content.slice(0, 8000)}`;

  return callAI(system, user, 1024);
}

async function generateTagsList(title: string, summary: string): Promise<string[]> {
  const system = 'You are a tag generator. Respond with ONLY a JSON array of strings, e.g. ["tag1", "tag2", "tag3"]. Nothing else.';
  const user = `Generate 3-5 concise tags for this article. Tags should be:
- In the same language as the article
- Short (1-3 words each)
- Specific and descriptive

Title: ${title}
Summary: ${summary}

Respond with ONLY a JSON array.`;

  const raw = await callAI(system, user);
  try {
    const tags = JSON.parse(raw.trim());
    return Array.isArray(tags) ? tags.filter((tag) => typeof tag === 'string') : [];
  } catch {
    return [];
  }
}

async function loadSummarySource(articleId: number) {
  const [article] = await db
    .select({
      id: articles.id,
      title: articles.title,
      summary: articles.summary,
      contentHtml: articles.contentHtml,
      contentMarkdown: articles.contentMarkdown,
    })
    .from(articles)
    .where(eq(articles.id, articleId));

  if (!article) return null;

  return article;
}

export async function buildArticleSummaryResult(articleId: number): Promise<ArticleSummaryResult> {
  const article = await loadSummarySource(articleId);
  if (!article) return { summary: null, category: null, tags: [] };

  const title = article.title || '';
  const summaryFallback = article.summary || '';

  const content =
    article.contentMarkdown ||
    (await fetchArticleContentFromSources(articleId, 'markdown').catch((e) => {
      console.error(`Fetch markdown for summary failed for article ${articleId}:`, e.message);
      return null;
    })) ||
    article.contentHtml ||
    summaryFallback;

  if (!content) return { summary: null, category: null, tags: [] };

  const summary = await generateDigestText(title, content).catch((e) => {
    console.error(`AI digest failed for article ${articleId}:`, e.message);
    return null;
  });

  const tags = summary
    ? await generateTagsList(title, summary).catch((e) => {
        console.error(`AI tags failed for article ${articleId}:`, e.message);
        return [] as string[];
      })
    : [];

  return {
    summary,
    category: null,
    tags,
  };
}

export async function generateArticleDigest(articleId: number, title: string, content: string): Promise<void> {
  const digest = await generateDigestText(title, content);
  await db.update(articleMetadata).set({ aiSummary: digest, updatedAt: new Date() }).where(eq(articleMetadata.articleId, articleId));
}

export async function generateTags(articleId: number, title: string, summary: string): Promise<void> {
  const tags = await generateTagsList(title, summary);
  if (tags.length > 0) {
    await db.update(articleMetadata).set({ aiTags: tags, updatedAt: new Date() }).where(eq(articleMetadata.articleId, articleId));
  }
}

export async function generateSummaryAndTags(articleId: number): Promise<void> {
  const [article] = await db
    .select({
      id: articles.id,
      title: articles.title,
      summary: articles.summary,
      contentHtml: articles.contentHtml,
      contentMarkdown: articles.contentMarkdown,
    })
    .from(articles)
    .where(eq(articles.id, articleId));
  if (!article) return;

  const title = article.title || '';
  const contentMd = await getArticleContent(articleId).catch((e) => {
    console.error('Fetch markdown failed:', e.message);
    return null;
  });

  const content = contentMd || article.contentMarkdown || article.contentHtml || article.summary || '';
  if (!content) return;

  const digest = await generateDigestText(title, content).catch((e) => {
    console.error('AI digest failed:', e.message);
    return null;
  });

  if (!digest) return;

  await db.update(articleMetadata).set({ aiSummary: digest, updatedAt: new Date() }).where(eq(articleMetadata.articleId, articleId));

  const tags = await generateTagsList(title, digest).catch((e) => {
    console.error('AI tags failed:', e.message);
    return [] as string[];
  });

  if (tags.length > 0) {
    await db.update(articleMetadata).set({ aiTags: tags, updatedAt: new Date() }).where(eq(articleMetadata.articleId, articleId));
  }
}
