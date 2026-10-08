import { db } from '../db/index.js';
import { articles, articleMetadata } from '../db/schema.js';
import { and, eq } from 'drizzle-orm';
import { getArticleContent } from './reader.service.js';
import { applyAiCategory, listCategories } from './category.service.js';
import { callUserAi } from './ai-provider.service.js';
import { resolveUserAiRuntimeConfig, type UserAiRuntimeConfig } from './user-ai-settings.service.js';

export type ArticleSummaryResult = {
  summary: string | null;
  category: string | null;
  tags: string[];
};

export type ControlledCategoryCandidate = {
  id: number;
  name: string;
  description: string | null;
  includeExamples: string[];
  excludeExamples: string[];
};

export type ControlledCategoryResult = {
  categoryId: number | null;
  confidence: number;
  reason: string | null;
  modelVersion: string | null;
};

export type CategoryDescriptionDraft = {
  description: string;
  includeExamples: string[];
  excludeExamples: string[];
};

export const AI_INPUT_CHAR_LIMIT = 24000;

export type CombinedAiGenerationResult = {
  summary: string;
  tags: string[];
  categoryId: number | null;
  confidence: number | null;
  reason: string | null;
  modelVersion: string;
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
  contentTruncated: boolean;
};

export type CombinedAiPromptInput = {
  title: string;
  summary: string;
  content: string;
  categories: ControlledCategoryCandidate[];
  manualCategoryId?: number | null;
};

export type CombinedAiPromptOptions = {
  includeCategory: boolean;
  manualCategoryId?: number | null;
};

export type CombinedAiPrompt = {
  system: string;
  user: string;
  maxTokens: number;
  contentTruncated: boolean;
};

export type CombinedAiUsage = {
  promptTokens: number | null;
  completionTokens: number | null;
  totalTokens: number | null;
};

export async function generateCombinedArticleAi(
  userId: number,
  articleId: number,
  options: CombinedAiPromptOptions,
  callAi: (config: UserAiRuntimeConfig, system: string, user: string, maxTokens: number) => ReturnType<typeof callUserAi> = callUserAi,
): Promise<CombinedAiGenerationResult> {
  const runtimeConfig = await resolveUserAiRuntimeConfig(userId);
  if (!runtimeConfig) throw new Error('AI_NOT_CONFIGURED');

  const [article] = await db
    .select({
      title: articles.title,
      summary: articles.summary,
      contentMarkdown: articles.contentMarkdown,
      contentHtml: articles.contentHtml,
    })
    .from(articles)
    .where(eq(articles.id, articleId))
    .limit(1);
  if (!article) throw new Error('AI_ARTICLE_NOT_FOUND');

  const cachedMarkdown = await getArticleContent(articleId, 'markdown', 'desktop', userId).catch(() => null);
  const cachedHtml = await getArticleContent(articleId, 'html', 'desktop', userId).catch(() => null);
  const categories = (await listCategories(userId))
    .filter((category) => !category.isSystem)
    .map((category) => ({
      id: category.id,
      name: category.name,
      description: category.description,
      includeExamples: category.includeExamples,
      excludeExamples: category.excludeExamples,
    }));

  const prompt = buildCombinedAiPrompt({
    title: article.title || '',
    summary: article.summary || '',
    content: cachedMarkdown || article.contentMarkdown || cachedHtml || article.contentHtml || article.summary || '',
    categories,
    manualCategoryId: options.manualCategoryId ?? null,
  }, options);
  const aiResult = await callAi(runtimeConfig, prompt.system, prompt.user, prompt.maxTokens);

  return parseCombinedAiResult(aiResult.content, {
    modelVersion: runtimeConfig.model,
    categories,
    manualCategoryId: options.manualCategoryId ?? null,
    includeCategory: options.includeCategory,
    contentTruncated: prompt.contentTruncated,
  }, {
    promptTokens: aiResult.promptTokens,
    completionTokens: aiResult.completionTokens,
    totalTokens: aiResult.totalTokens,
  });
}

export function buildCombinedAiPrompt(
  input: CombinedAiPromptInput,
  options: CombinedAiPromptOptions,
): CombinedAiPrompt {
  const contentTruncated = input.content.length > AI_INPUT_CHAR_LIMIT;
  const content = contentTruncated
    ? `${input.content.slice(0, AI_INPUT_CHAR_LIMIT)}（已截断到 24000 个字符）`
    : input.content;
  const payload = {
    title: input.title,
    summary: input.summary,
    content,
    categories: options.includeCategory ? input.categories : [],
    manualCategoryId: input.manualCategoryId ?? null,
  };

  return {
    system: options.includeCategory
      ? '你是文章摘要、标签和分类助手。仅输出 JSON：{"summary":"不超过 200 字","tags":["3 到 5 个"],"category_id":候选分类 ID,"confidence":0 到 1,"reason":"不超过 80 字"}。只能从候选分类中选择。'
      : '你是文章摘要和标签助手。仅输出 JSON：{"summary":"不超过 200 字","tags":["3 到 5 个"]}。',
    user: JSON.stringify(payload),
    maxTokens: options.includeCategory ? 1024 : 768,
    contentTruncated,
  };
}

function parseJsonObject(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  const text = (fenced?.[1] ?? trimmed).trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) {
    throw new Error('AI_OUTPUT_INVALID: 模型输出不是有效 JSON 对象');
  }
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('not-object');
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new Error('AI_OUTPUT_INVALID: 模型输出不是有效 JSON 对象');
  }
}

function normalizeCombinedTags(value: unknown): string[] {
  if (!Array.isArray(value)) throw new Error('AI_OUTPUT_INVALID: 标签必须为数组');
  const tags = [...new Set(value
    .filter((tag): tag is string => typeof tag === 'string')
    .map((tag) => tag.trim())
    .filter(Boolean))];
  if (tags.length < 3) throw new Error('AI_OUTPUT_INVALID: 标签至少需要 3 个');
  return tags.slice(0, 5);
}

export function parseCombinedAiResult(
  raw: string,
  context: {
    modelVersion: string;
    categories: ControlledCategoryCandidate[];
    manualCategoryId?: number | null;
    includeCategory: boolean;
    contentTruncated: boolean;
  },
  usage: CombinedAiUsage,
): CombinedAiGenerationResult {
  const parsed = parseJsonObject(raw);
  const summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : '';
  if (!summary) throw new Error('AI_OUTPUT_INVALID: 摘要不能为空');
  const tags = normalizeCombinedTags(parsed.tags);

  let categoryId: number | null = null;
  let confidence: number | null = null;
  let reason: string | null = null;
  if (context.includeCategory) {
    const candidateId = parsed.category_id;
    if (typeof candidateId !== 'number' || !context.categories.some((category) => category.id === candidateId)) {
      throw new Error('AI_OUTPUT_INVALID: 分类 ID 不在启用候选内');
    }
    categoryId = candidateId;
    confidence = typeof parsed.confidence === 'number' && Number.isFinite(parsed.confidence)
      ? Math.min(1, Math.max(0, parsed.confidence))
      : null;
    reason = typeof parsed.reason === 'string' && parsed.reason.trim() ? parsed.reason.trim().slice(0, 240) : null;
  } else {
    categoryId = context.manualCategoryId ?? null;
  }

  return {
    summary,
    tags,
    categoryId,
    confidence,
    reason,
    modelVersion: context.modelVersion,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    totalTokens: usage.totalTokens,
    contentTruncated: context.contentTruncated,
  };
}

/** 根据用户给出的分类名称生成可继续编辑的分类边界，不会创建或修改分类。 */
export async function optimizeCategoryDescription(userId: number, input: {
  name: string;
  description?: string | null;
  includeExamples?: string[];
  excludeExamples?: string[];
}): Promise<CategoryDescriptionDraft> {
  const runtimeConfig = await resolveUserAiRuntimeConfig(userId);
  if (!runtimeConfig) throw new Error('AI_NOT_CONFIGURED');
  const aiResult = await callUserAi(runtimeConfig,
    '你负责协助用户定义个人知识库分类规则。不要新增分类名称，不要输出营销文案。根据分类名称给出一段清楚、简短、便于 AI 判断归档归属的说明，并提供收录边界。仅输出 JSON：{"description":"不超过 120 字","include_examples":["最多 5 条"],"exclude_examples":["最多 5 条"]}。',
    `分类名称：${input.name}\n\n现有说明：${input.description || '无'}\n\n现有适合收录示例：${JSON.stringify(input.includeExamples || [])}\n\n现有不适合收录示例：${JSON.stringify(input.excludeExamples || [])}`,
      640);
  const raw = aiResult.content;

  try {
    const json = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    const parsed = JSON.parse(json) as { description?: unknown; include_examples?: unknown; exclude_examples?: unknown };
    const normalizeExamples = (value: unknown) => Array.isArray(value)
      ? value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean).slice(0, 5)
      : [];
    const description = typeof parsed.description === 'string' ? parsed.description.trim().slice(0, 120) : '';
    if (!description) throw new Error('AI 未返回有效说明');
    return {
      description,
      includeExamples: normalizeExamples(parsed.include_examples),
      excludeExamples: normalizeExamples(parsed.exclude_examples),
    };
  } catch (error) {
    throw new Error(error instanceof Error && error.message === 'AI 未返回有效说明' ? error.message : 'AI 返回的分类说明无法解析');
  }
}

export async function classifyStoredArticleForArchive(articleId: number, userId: number): Promise<void> {
  const result = await generateCombinedArticleAi(userId, articleId, { includeCategory: true });
  if (result.categoryId !== null) {
    await applyAiCategory(userId, articleId, {
      categoryId: result.categoryId,
      confidence: result.confidence ?? 0,
      reason: result.reason,
      modelVersion: result.modelVersion,
    });
  }
  await db.update(articleMetadata)
    .set({
      aiSummary: result.summary,
      aiTags: result.tags,
      aiStatus: 'succeeded',
      aiErrorCode: null,
      aiErrorMessage: null,
      aiModel: result.modelVersion,
      aiTotalTokens: result.totalTokens,
      aiContentTruncated: result.contentTruncated,
      updatedAt: new Date(),
    })
    .where(and(eq(articleMetadata.articleId, articleId), eq(articleMetadata.userId, userId)));
}

export async function buildArticleSummaryResult(articleId: number, userId: number): Promise<ArticleSummaryResult> {
  const combined = await generateCombinedArticleAi(userId, articleId, { includeCategory: false });
  return { summary: combined.summary, category: null, tags: combined.tags };
}

export async function generateSummaryAndTags(articleId: number, userId: number): Promise<void> {
  const result = await generateCombinedArticleAi(userId, articleId, { includeCategory: false });
  await db
    .update(articleMetadata)
    .set({
      aiSummary: result.summary,
      aiTags: result.tags,
      aiStatus: 'succeeded',
      aiErrorCode: null,
      aiErrorMessage: null,
      aiModel: result.modelVersion,
      aiTotalTokens: result.totalTokens,
      aiContentTruncated: result.contentTruncated,
      updatedAt: new Date(),
    })
    .where(and(eq(articleMetadata.articleId, articleId), eq(articleMetadata.userId, userId)));
}
