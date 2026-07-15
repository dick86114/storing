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

test('wiki queries and enqueue are limited to admin metadata scope', () => {
  const wiki = read('src/services/wiki.service.ts');
  assert.match(wiki, /import \{ getAdminUserId \} from '\.\/metadata-scope\.service\.js';/);
  assert.match(wiki, /const adminUserId = await getAdminUserId\(\);[\s\S]*eq\(articleMetadata\.userId, adminUserId\)/);
  assert.doesNotMatch(wiki, /innerJoin\(articleMetadata, eq\(articles\.id, articleMetadata\.articleId\)\)/);
  assert.doesNotMatch(wiki, /leftJoin\(articleMetadata, eq\(articles\.id, articleMetadata\.articleId\)\)/);
});

test('reader display repair uses the caller user metadata scope', () => {
  const reader = read('src/services/reader.service.ts');
  const routes = read('src/routes/articles.ts');
  assert.match(reader, /repairArticleDisplayMeta\(articleId: number, userId\?: number\)/);
  assert.doesNotMatch(reader, /leftJoin\(articleMetadata, eq\(articles\.id, articleMetadata\.articleId\)\)/);
  assert.match(routes, /repairArticleDisplayMeta\(row\.id, userId\)/);
  assert.match(routes, /repairArticleDisplayMeta\(id, userId\)/);
});
