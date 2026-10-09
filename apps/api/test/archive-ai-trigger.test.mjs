import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const articles = read('../src/routes/articles.ts');
const aiService = read('../src/services/ai.service.ts');
const aiGeneration = read('../src/services/ai-generation.service.ts');
const mcp = read('../src/routes/mcp.ts');
const collect = read('../src/services/collect.service.ts');
const wechatImport = read('../src/services/wechat-import.service.ts');

test('归档接口按用户设置触发 AI，不在归档请求内等待生成', () => {
  const archiveRoute = articles.match(/articlesRoutes\.post\('\/articles\/:id\/archive'[\s\S]*?\n}\);/)?.[0] ?? '';
  assert.match(archiveRoute, /queueArchiveAiIfNeeded\(/);
  assert.match(archiveRoute, /existingAiReady/);
  assert.match(archiveRoute, /processCoverImage\(/);
  assert.doesNotMatch(archiveRoute, /generateSummaryAndTags\(/);
  assert.doesNotMatch(archiveRoute, /classifyStoredArticleForArchive\(/);
  assert.match(aiGeneration, /export async function queueArchiveAiIfNeeded/);
  assert.match(aiGeneration, /triggerType: 'archive'/);
  assert.match(aiGeneration, /includeCategory: !options\.userSelectedCategory/);
});

test('手动生成允许收件箱文章，且不清空旧 AI 结果', () => {
  const route = articles.match(/articlesRoutes\.post\('\/articles\/:id\/regenerate-ai'[\s\S]*?\n}\);/)?.[0] ?? '';
  assert.doesNotMatch(route, /ARTICLE_NOT_ARCHIVED|!ownedArticle\.isArchived/);
  assert.match(route, /enqueueAiGeneration\(/);
  assert.match(route, /triggerType: 'manual'/);
  assert.match(route, /includeCategory: false/);
  assert.match(route, /AI_NOT_CONFIGURED/);
  assert.match(route, /ok: true/);
  assert.doesNotMatch(route, /aiSummary: null/);
  assert.doesNotMatch(route, /aiTags: \[\]/);
});

test('手动或归档任务入队后立即触发本进程生成 worker', () => {
  const enqueueFunction = aiGeneration.match(
    /export async function enqueueAiGeneration[\s\S]*?\n}\n\nexport async function queueArchiveAiIfNeeded/,
  )?.[0] ?? '';
  assert.ok(enqueueFunction, 'enqueueAiGeneration implementation should be present');

  assert.match(enqueueFunction, /const startWorkers = \(\) => \{/);
  assert.match(enqueueFunction, /void runAiGenerationWorkers\(\)\.catch/);
  const calls = enqueueFunction.match(/startWorkers\(\);/g) ?? [];
  assert.equal(calls.length, 2, 'active and newly created jobs must both wake a worker');
});

test('分类说明优化使用当前用户模型，不回退公共 Key', () => {
  assert.match(aiService, /export async function optimizeCategoryDescription\(\s*userId: number/);
  assert.match(aiService, /resolveUserAiRuntimeConfig\(userId\)/);
  assert.match(aiService, /if \(!runtimeConfig\) throw new Error\('AI_NOT_CONFIGURED'\)/);
  assert.match(aiService, /callUserAi\(runtimeConfig,/);
  const optimizeFunction = aiService.match(/export async function optimizeCategoryDescription[\s\S]*?\n}\n/)?.[0] ?? '';
  assert.doesNotMatch(optimizeFunction, /callAI\(/);
  assert.doesNotMatch(optimizeFunction, /AI_PROVIDER|AI_MODEL|AI_API_KEY|ANTHROPIC_API_KEY|CUSTOM_AI/);
});

test('MCP 采集不触发 AI，摘要使用 owner 用户配置', () => {
  const collectRoute = mcp.match(/mcpRoutes\.post\('\/mcp\/collect'[\s\S]*?\n}\);/)?.[0] ?? '';
  const summarizeRoute = mcp.match(/mcpRoutes\.post\('\/mcp\/summarize'[\s\S]*?\n}\);/)?.[0] ?? '';
  assert.doesNotMatch(collectRoute, /enqueueAiGeneration|queueArchiveAiIfNeeded/);
  assert.match(summarizeRoute, /resolveUserAiRuntimeConfig\(client\.ownerUserId\)/);
  assert.match(summarizeRoute, /AI_NOT_CONFIGURED/);
  assert.match(summarizeRoute, /userId: client\.ownerUserId/);
});

test('采集和微信导入只保存内容，不再调用公共 AI 服务', () => {
  assert.doesNotMatch(collect, /generateSummaryAndTags\(|classifyStoredArticleForArchive\(/);
  assert.match(collect, /buildArticleSummaryResult\(articleId, options\.userId\)/);
  assert.doesNotMatch(wechatImport, /generateSummaryAndTags\(/);
  assert.match(aiService, /export async function buildArticleSummaryResult\(articleId: number, userId: number\)/);
});
