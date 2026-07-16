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

  assert.match(routes, /import \{ randomUUID \} from 'node:crypto';/);
  assert.match(routes, /await generateSummaryAndTags\(id, userId\)/);
  assert.match(routes, /isArchived: true/);
  assert.match(routes, /isPublished: true/);
  assert.match(routes, /publicId: existingMetadata\.publicId \|\| randomUUID\(\)/);
  assert.match(routes, /publicUrl: `\/p\/\$\{published\.publicId\}`/);
});

test('unpublish preserves archive data and hides only the public state', () => {
  const routes = read('src/routes/articles.ts');

  assert.match(routes, /articlesRoutes\.post\('\/articles\/:id\/unpublish', requireAuth/);
  assert.match(routes, /\.set\(\{[\s\S]*isPublished: false/);
  assert.doesNotMatch(routes, /unpublish[\s\S]{0,900}isArchived: false/);
  assert.doesNotMatch(routes, /unpublish[\s\S]{0,900}publishedAt: null/);
});


test('Wiki storage and API handlers carry an explicit user scope', () => {
  const schema = read('src/db/schema.ts');
  const routes = read('src/routes/wiki.ts');
  const wiki = read('src/services/wiki.service.ts');

  assert.match(schema, /wikiArticles[\s\S]*userId: integer\('user_id'\)/);
  assert.match(schema, /wikiPages[\s\S]*userId: integer\('user_id'\)/);
  assert.match(routes, /wikiRoutes\.get\('\/wiki', requireAuth/);
  assert.match(routes, /const userId = getCurrentUser\(c\)\.id as number/);
  assert.match(wiki, /userId: number/);
  assert.doesNotMatch(wiki, /getAdminUserId/);
});

test('Wiki user scope replaces global article and slug uniqueness', () => {
  const migration = read('src/services/metadata-scope.service.ts');

  assert.match(migration, /wiki_articles_user_article_unique/);
  assert.match(migration, /wiki_pages_user_slug_unique/);
});

test('legacy global Wiki data is reset once instead of being attributed to a user', () => {
  const migration = read('src/services/metadata-scope.service.ts');

  assert.match(migration, /wiki_private_scope_reset_v1/);
  assert.match(migration, /TRUNCATE TABLE wiki_articles, wiki_article_extracts, wiki_pages, wiki_page_sources/);
});
