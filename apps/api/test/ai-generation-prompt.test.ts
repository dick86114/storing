import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  buildCombinedAiPrompt,
  parseCombinedAiResult,
} from '../src/services/ai.service.ts';

const serviceSource = readFileSync(new URL('../src/services/ai.service.ts', import.meta.url), 'utf8');

const combinedType = serviceSource.slice(
  serviceSource.indexOf('export type CombinedAiGenerationResult'),
  serviceSource.indexOf('export function buildCombinedAiPrompt'),
);

test('账号级 AI 合并生成返回摘要、标签、分类和用量', () => {
  assert.match(serviceSource, /export const AI_INPUT_CHAR_LIMIT = 24000/);
  assert.match(combinedType, /summary: string/);
  assert.match(combinedType, /tags: string\[\]/);
  assert.match(combinedType, /categoryId: number \| null/);
  assert.match(combinedType, /confidence: number \| null/);
  assert.match(combinedType, /reason: string \| null/);
  assert.match(combinedType, /modelVersion: string/);
  assert.match(combinedType, /promptTokens: number \| null/);
  assert.match(combinedType, /completionTokens: number \| null/);
  assert.match(combinedType, /totalTokens: number \| null/);
  assert.match(combinedType, /contentTruncated: boolean/);
});

test('合并生成只调用用户配置，不写库也不回退公共模型 Key', () => {
  const functionSource = serviceSource.slice(
    serviceSource.indexOf('export async function generateCombinedArticleAi'),
    serviceSource.indexOf('export function buildCombinedAiPrompt'),
  );
  assert.match(functionSource, /const runtimeConfig = await resolveUserAiRuntimeConfig\(userId\)/);
  assert.match(functionSource, /if \(!runtimeConfig\) throw new Error\('AI_NOT_CONFIGURED'\)/);
  assert.match(functionSource, /getArticleContent\(articleId, 'markdown', 'desktop', userId\)/);
  assert.match(functionSource, /callAi\(runtimeConfig, prompt\.system, prompt\.user, prompt\.maxTokens\)/);
  assert.doesNotMatch(functionSource, /AI_PROVIDER|AI_MODEL|AI_API_KEY|ANTHROPIC_API_KEY|CUSTOM_AI/);
  assert.doesNotMatch(functionSource, /\.update\(|\.insert\(|\.delete\(/);
});

test('合并提示包含标题、正文和启用分类候选，并按 24000 字截断', () => {
  const prompt = buildCombinedAiPrompt({
    title: '用户 AI 配置',
    summary: '原始摘要',
    content: 'a'.repeat(24001),
    categories: [
      { id: 12, name: '技术', description: '技术文章', includeExamples: [], excludeExamples: [] },
    ],
    manualCategoryId: null,
  }, { includeCategory: true });

  assert.equal(prompt.contentTruncated, true);
  assert.doesNotMatch(prompt.user, /a{24001}/);
  assert.match(prompt.user, /24000 个字符/);
  assert.match(prompt.system, /category_id/);
  assert.match(prompt.user, /"id":12/);
  assert.match(prompt.system, /summary|tags|category_id/);
});

test('手动分类时提示不包含分类候选，输出只要摘要和标签', () => {
  const prompt = buildCombinedAiPrompt({
    title: '标题',
    summary: '',
    content: '正文',
    categories: [{ id: 1, name: '技术', description: null, includeExamples: [], excludeExamples: [] }],
    manualCategoryId: 1,
  }, { includeCategory: false });

  assert.doesNotMatch(prompt.system, /category_id/);
  assert.doesNotMatch(prompt.user, /分类候选/);
  assert.match(prompt.system, /summary|tags/);
});

test('合并输出解析 JSON、代码块和用量，标签规范化为 3-5 个', () => {
  const result = parseCombinedAiResult('```json\n{"summary":"摘要","tags":["技术"," 架构 ","","AI","测试","额外"],"category_id":8,"confidence":0.9,"reason":"合适"}\n```', {
    modelVersion: 'deepseek-chat',
    categories: [{ id: 8, name: '技术', description: null, includeExamples: [], excludeExamples: [] }],
    manualCategoryId: null,
    includeCategory: true,
    contentTruncated: false,
  }, { promptTokens: 10, completionTokens: 5, totalTokens: 15 });

  assert.equal(result.summary, '摘要');
  assert.deepEqual(result.tags, ['技术', '架构', 'AI', '测试', '额外']);
  assert.equal(result.categoryId, 8);
  assert.equal(result.modelVersion, 'deepseek-chat');
  assert.deepEqual({
    promptTokens: result.promptTokens,
    completionTokens: result.completionTokens,
    totalTokens: result.totalTokens,
  }, { promptTokens: 10, completionTokens: 5, totalTokens: 15 });
});

test('分类 ID 不属于启用候选时结果无效', () => {
  assert.throws(() => parseCombinedAiResult('{"summary":"摘要","tags":["技术","架构","AI"],"category_id":999,"confidence":0.9}', {
    modelVersion: 'model',
    categories: [{ id: 8, name: '技术', description: null, includeExamples: [], excludeExamples: [] }],
    manualCategoryId: null,
    includeCategory: true,
    contentTruncated: false,
  }), /AI_OUTPUT_INVALID/);
});
