import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const bulkService = read('src/services/article-bulk.service.ts');

test('AI metadata writes are scoped by userId', () => {
  const ai = read('src/services/ai.service.ts');
  assert.match(ai, /generateSummaryAndTags\(articleId: number, userId: number\)/);
  assert.doesNotMatch(ai, /\.where\(eq\(articleMetadata\.articleId, articleId\)\)/);
});

test('article routes pass current userId into user-visible side effects', () => {
  const routes = read('src/routes/articles.ts');
  assert.doesNotMatch(routes, /generateSummaryAndTags\(id\)(?![,\w])/);
  assert.doesNotMatch(routes, /processCoverImage\(id\)(?![,\w])/);
  assert.match(routes, /getArticleContent\(id, format as 'markdown' \| 'html', htmlVariant, userId\)/);
});

test('collect inbox side effects pass collection user scope', () => {
  const collect = read('src/services/collect.service.ts');
  assert.match(collect, /finishArticleSideEffects\(jobId: number, articleId: number, options: \{[^}]*userId\?: number \| null/);
  assert.match(collect, /buildArticleSummaryResult\(articleId, options\.userId\)/);
  assert.doesNotMatch(collect, /generateSummaryAndTags\(/);
  assert.match(collect, /processCoverImage\(articleId, options\.userId\)/);
});

test('combined AI generation is scoped to user settings and does not fall back to shared keys', () => {
  const ai = read('src/services/ai.service.ts');
  const start = ai.indexOf('export async function generateCombinedArticleAi');
  const end = ai.indexOf('export function buildCombinedAiPrompt', start);
  const combined = ai.slice(start, end);

  assert.match(combined, /resolveUserAiRuntimeConfig\(userId\)/);
  assert.match(combined, /AI_NOT_CONFIGURED/);
  assert.doesNotMatch(combined, /AI_PROVIDER|AI_MODEL|AI_API_KEY|ANTHROPIC_API_KEY|CUSTOM_AI/);
});

test('reader display repair uses the caller user metadata scope', () => {
  const reader = read('src/services/reader.service.ts');
  const routes = read('src/routes/articles.ts');
  assert.match(reader, /repairArticleDisplayMeta\(articleId: number, userId\?: number\)/);
  assert.doesNotMatch(reader, /leftJoin\(articleMetadata, eq\(articles\.id, articleMetadata\.articleId\)\)/);
  assert.match(routes, /repairArticleDisplayMeta\(row\.id, userId\)/);
  assert.match(routes, /repairArticleDisplayMeta\(id, userId\)/);
});

test('articles route exposes publish and unpublish endpoints with auth', () => {
  const route = read('src/routes/articles.ts');
  assert.match(route, /articlesRoutes\.post\('\/articles\/:id\/publish', requireAuth/);
  assert.match(route, /articlesRoutes\.post\('\/articles\/:id\/unpublish', requireAuth/);
  assert.match(route, /publishArticleForUser/);
  assert.match(route, /unpublishArticleForUser/);
  assert.match(bulkService, /isPublished: true/);
  assert.match(bulkService, /isPublished: false/);
});

test('published view is accessible without auth via is_published filter', () => {
  const route = read('src/routes/articles.ts');
  assert.match(route, /view === 'published'/);
  assert.match(route, /is_published/);
  assert.doesNotMatch(route, /getDefaultUserId/);
});

test('counts includes published count accessible to all users', () => {
  const route = read('src/routes/articles.ts');
  assert.match(route, /published/);
});
