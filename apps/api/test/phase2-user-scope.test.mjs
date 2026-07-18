import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

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
  assert.match(collect, /finishArticleSideEffects\(jobId: number, articleId: number, options: \{ saveToInbox: boolean; userId\?: number \| null \}/);
  assert.match(collect, /generateSummaryAndTags\(articleId, options\.userId\)/);
  assert.match(collect, /processCoverImage\(articleId, options\.userId\)/);
});

test('wiki queries and enqueue are explicitly scoped to the requesting user', () => {
  const wiki = read('src/services/wiki.service.ts');
  assert.match(wiki, /function metadataJoinCondition\(userId: number\)/);
  assert.match(wiki, /enqueueArticleForWiki\(articleId: number, userId: number/);
  assert.doesNotMatch(wiki, /getAdminUserId/);
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
  assert.match(route, /isPublished: true/);
  assert.match(route, /isPublished: false/);
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
