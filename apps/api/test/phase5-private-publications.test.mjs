import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const root = new URL('../', import.meta.url);
const read = (path) => readFileSync(new URL(path, root), 'utf8');

test('publication schema is stored on user article metadata and migrated at startup', () => {
  const schema = read('src/db/schema.ts');
  const migration = read('src/services/metadata-scope.service.ts');
  const index = read('src/index.ts');

  assert.match(schema, /publicId:\s*text\('public_id'\)\.unique\(\)/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT FALSE/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS published_at TIMESTAMP/);
  assert.match(migration, /ADD COLUMN IF NOT EXISTS public_id TEXT/);
  assert.match(migration, /CREATE UNIQUE INDEX IF NOT EXISTS article_metadata_public_id_unique/);
  assert.match(index, /ensurePrivateLibraryPublicationSchema\(\)/);
});

test('public reads use a token-addressed publication instead of an article id bypass', () => {
  const routes = read('src/routes/articles.ts');

  assert.match(routes, /articlesRoutes\.get\('\/publications\/:publicId', optionalAuth/);
  assert.match(routes, /eq\(articleMetadata\.publicId, publicId\)/);
  assert.match(routes, /eq\(articleMetadata\.isPublished, true\)/);
  assert.doesNotMatch(routes, /if \(!isAuthenticated\(c\) && !article\.isArchived\)/);
});

test('authenticated publication management remains scoped to the current user', () => {
  const routes = read('src/routes/articles.ts');

  assert.match(routes, /view === 'published'[\s\S]*scope === 'mine'/);
  assert.match(routes, /metadataJoinCondition\(userId\)/);
  assert.match(routes, /WHERE m\.user_id = \$\{userId\}[\s\S]*m\.is_published = true/);
});

test('publish prepares a private archive before it exposes a public token', () => {
  const routes = read('src/routes/articles.ts');
  const service = read('src/services/article-bulk.service.ts');
  const publish = service.slice(service.indexOf('export async function publishArticleForUser'));

  assert.match(service, /import \{ randomUUID \} from 'node:crypto';/);
  assert.doesNotMatch(routes, /await generateSummaryAndTags\(id, userId\)/);
  assert.match(publish, /isArchived: true/);
  assert.match(publish, /isPublished: true/);
  assert.match(publish, /publicId: record\.publicId \|\| randomUUID\(\)/);
  assert.match(publish, /publicUrl: `\/p\/\$\{updated\.publicId\}`/);
});

test('unpublish preserves archive data and hides only the public state', () => {
  const routes = read('src/routes/articles.ts');
  const service = read('src/services/article-bulk.service.ts');
  const unpublish = service.slice(service.indexOf('export async function unpublishArticleForUser'));

  assert.match(routes, /articlesRoutes\.post\('\/articles\/:id\/unpublish', requireAuth/);
  assert.match(unpublish, /\.set\(\{[\s\S]*isPublished: false/);
  assert.doesNotMatch(unpublish, /isArchived: false/);
  assert.doesNotMatch(unpublish, /publishedAt: null/);
});
