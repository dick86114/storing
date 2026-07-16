# Private Library Publications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make article collections and Wiki data private to each user, while allowing users to publish a fully archived article to a stable public URL that guests can read and share.

**Architecture:** User-specific state remains in `article_metadata`, keyed by the existing `(user_id, article_id)` uniqueness constraint. Add a durable `public_id` to the same row rather than adding a second publication table. Convert Wiki rows and all Wiki reads/writes to an explicit `user_id` scope; serve guest content only from a narrow public publication projection and a token-addressed public-detail endpoint.

**Tech Stack:** TypeScript, Hono, Drizzle ORM, PostgreSQL, Next.js 15 App Router, React, Node built-in test runner, pnpm.

## Global Constraints

- Implement **only** the selected metadata-backed publication model; do not add a `publications` table or a global `articles.is_published` state.
- Preserve all existing user worktree changes. Never use `git reset`, `git checkout --`, `git clean`, or broad reformatting on unrelated files.
- Every private read and write must derive `user_id` from the authenticated request; do not infer an owner from the global `article_id`.
- Guests may read only the public publication feed and a currently published `/p/:publicId` page; guests must not read Wiki, archive, favorites, inbox, or `/articles/:id`.
- Publishing must be idempotent and must not expose an article until its archive content, AI summary, category, and tags are available.
- A publication token is an unguessable UUID generated with Node `randomUUID()` and remains stable across unpublish/re-publish.
- Schema changes must be PostgreSQL-compatible, additive, and repeatable using `IF NOT EXISTS` guards in the startup schema service.
- Keep the existing visual system and responsive breakpoints described in `docs/PRD-Readwise-Later.md`; do not introduce a new design language.
- Use TDD for each task: write the named failing test first, prove it fails, implement the smallest change, then run the passing test before the task commit.

---

## File Map

| File | Responsibility |
| --- | --- |
| `apps/api/src/db/schema.ts` | Drizzle declarations for publication token and user-owned Wiki rows/indexes. |
| `apps/api/src/services/metadata-scope.service.ts` | Repeatable runtime schema migration, legacy backfill, index replacement, and Wiki scope migration. |
| `apps/api/src/index.ts` | Invoke the expanded startup migration before serving API traffic. |
| `apps/api/src/routes/articles.ts` | Private article reads, scoped counts, publish/unpublish workflow, public feed, and public detail API. |
| `apps/api/src/routes/wiki.ts` | Authentication wall and current-user scope injection for every Wiki endpoint. |
| `apps/api/src/services/wiki.service.ts` | User-scoped Wiki query and write APIs, queue jobs, sources, pages, graph, search, and logs. |
| `apps/api/src/services/wiki.worker.ts` | Process Wiki jobs in the job owner’s scope. |
| `apps/api/test/phase2-user-scope.test.mjs` | Update obsolete global/admin Wiki expectations to user-scoped expectations. |
| `apps/api/test/phase5-private-publications.test.mjs` | Regression checks for schema guards, public API contract, private guards, and publication flow. |
| `apps/web/src/lib/api.ts` | Publication types plus API client calls and public detail read method. |
| `apps/web/src/hooks/useArticleOperations.ts` | Publish/unpublish mutation and list cache update logic. |
| `apps/web/src/components/content/PublishedContent.tsx` | Authenticated user’s published-management Tab. |
| `apps/web/src/app/(main)/published/page.tsx` | Route for the authenticated published-management Tab. |
| `apps/web/src/app/published/page.tsx` | Guest-safe public publication feed route, outside the private main layout. |
| `apps/web/src/app/p/[publicId]/page.tsx` | Guest-safe public article detail route. |
| `apps/web/src/components/article/WechatArticleCard.tsx` | Publish/unpublish action affordance and published badge/menu text. |
| `apps/web/src/components/article/WechatDetailPanel.tsx` | Ensure-publish-before-share behavior and public-link copy/system-share behavior. |
| `apps/web/src/components/layout/DesktopTopNav.tsx` | Published navigation, guest/private navigation separation. |
| `apps/web/src/components/layout/MobileTopNav.tsx` | Published navigation, guest/private navigation separation on mobile. |
| `apps/web/src/app/(main)/layout.tsx` | Ensure private main shell routes remain behind the existing authenticated UX. |

## Task 1: Recover the Current Runtime and Add Stable Publication Schema

**Files:**
- Modify: `apps/api/src/db/schema.ts:1-112`
- Modify: `apps/api/src/services/metadata-scope.service.ts:17-103`
- Modify: `apps/api/src/index.ts:1-90`
- Create: `apps/api/test/phase5-private-publications.test.mjs`

**Interfaces:**
- Consumes: existing `initArticleMetadataUserScope(): Promise<void>` invoked during API startup.
- Produces: `articleMetadata.publicId`, `ensurePrivateLibraryPublicationSchema(): Promise<void>`, and a database that has `is_published`, `published_at`, and `public_id` before article routes query them.

- [ ] **Step 1: Write failing publication-schema tests**

Create `apps/api/test/phase5-private-publications.test.mjs` with these initial tests:

```js
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
```

- [ ] **Step 2: Run the failing test**

Run:

```bash
node --test apps/api/test/phase5-private-publications.test.mjs
```

Expected: FAIL because no `public_id` Drizzle field or publication migration function exists.

- [ ] **Step 3: Implement only the additive, repeatable schema guard**

1. In `apps/api/src/db/schema.ts`, declare the token beside the existing publication columns:

```ts
isPublished: boolean('is_published').notNull().default(false),
publishedAt: timestamp('published_at'),
publicId: text('public_id').unique(),
```

2. In `apps/api/src/services/metadata-scope.service.ts`, add and export this function after `initArticleMetadataUserScope`:

```ts
export async function ensurePrivateLibraryPublicationSchema() {
  await db.execute(sql.raw(`ALTER TABLE article_metadata ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT FALSE`));
  await db.execute(sql.raw(`ALTER TABLE article_metadata ADD COLUMN IF NOT EXISTS published_at TIMESTAMP`));
  await db.execute(sql.raw(`ALTER TABLE article_metadata ADD COLUMN IF NOT EXISTS public_id TEXT`));
  await db.execute(sql.raw(`CREATE UNIQUE INDEX IF NOT EXISTS article_metadata_public_id_unique ON article_metadata(public_id) WHERE public_id IS NOT NULL`));
}
```

3. Import `ensurePrivateLibraryPublicationSchema` in `apps/api/src/index.ts` and await it immediately after the existing user-scope initialization, before `serve(...)` is called.

4. Do not backfill random tokens in this task; Task 2 owns token generation because it must use the same canonical implementation as publish.

- [ ] **Step 4: Run the test and perform the minimal live recovery check**

Run:

```bash
node --test apps/api/test/phase5-private-publications.test.mjs
pnpm --filter api build
```

Restart the API through the project’s established restart flow, then verify:

```bash
curl -fsS http://localhost:1052/api/v1/health
curl -fsS 'http://localhost:1052/api/v1/articles?view=published&page=1&perPage=2'
```

Expected: health returns `{"status":"ok"}` and the published-list endpoint no longer fails with `column article_metadata.is_published does not exist`.

- [ ] **Step 5: Commit the isolated schema recovery**

```bash
git add apps/api/src/db/schema.ts apps/api/src/services/metadata-scope.service.ts apps/api/src/index.ts apps/api/test/phase5-private-publications.test.mjs
git commit -m "fix: migrate publication metadata before article queries"
```

## Task 2: Make Article Reads Private and Public Publications Token-Addressed

**Files:**
- Modify: `apps/api/src/routes/articles.ts:1-790`
- Modify: `apps/api/test/phase5-private-publications.test.mjs`

**Interfaces:**
- Consumes: `articleMetadata.publicId` and the user metadata join helpers.
- Produces:
  - `GET /articles?view=published&scope=mine` for authenticated publication management;
  - `GET /articles?view=published` as a guest-safe public feed;
  - `GET /publications/:publicId` for public detail;
  - private-only `GET /articles/:id` and `GET /articles/:id/meta` behavior.

- [ ] **Step 1: Extend the failing contract tests**

Append these tests to `apps/api/test/phase5-private-publications.test.mjs`:

```js
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
  assert.match(routes, /published_count/);
});
```

- [ ] **Step 2: Run the contract test**

Run:

```bash
node --test apps/api/test/phase5-private-publications.test.mjs
```

Expected: FAIL because the current public-detail guard uses global article ID availability and there is no `/publications/:publicId` endpoint.

- [ ] **Step 3: Implement the smallest private/public read split**

1. Add a public response mapper that includes only public fields:

```ts
function toPublicPublication(row: {
  id: number;
  publicId: string | null;
  title: string | null;
  author: string | null;
  source: string | null;
  originalUrl: string | null;
  publishTime: Date | null;
  coverImage: string | null;
  contentMd: string | null;
  contentHtml: string | null;
  aiSummary: string | null;
  aiCategory: string | null;
  aiTags: string[] | null;
  publishedAt: Date | null;
}) {
  return {
    id: row.id,
    publicId: row.publicId,
    publicUrl: row.publicId ? `/p/${row.publicId}` : null,
    title: row.title,
    author: row.author,
    source: row.source,
    originalUrl: row.originalUrl,
    publishTime: row.publishTime,
    coverImage: row.coverImage,
    contentMd: row.contentMd,
    contentHtml: row.contentHtml,
    aiSummary: row.aiSummary,
    aiCategory: row.aiCategory,
    aiTags: row.aiTags ?? [],
    publishedAt: row.publishedAt,
    isPublished: true,
    isArchived: true,
    isFavorited: false,
  };
}
```

2. For `view=published`, branch explicitly:
   - guests get the global `is_published = true` feed;
   - authenticated `scope=mine` joins with `metadataJoinCondition(userId)` and returns only that user’s publication rows;
   - authenticated calls without `scope=mine` may read the public feed but must never use it as the private management Tab.

3. Add `GET /publications/:publicId` before the private `GET /articles/:id` route. Query `article_metadata` joined to `articles` with both `public_id = :publicId` and `is_published = true`. Return 404 for unknown or unpublished tokens.

4. Remove guest fall-through from `/articles/:id/meta` and `/articles/:id`; when unauthenticated return 403. When authenticated, use `metadataWhereCondition(id, userId)` for every metadata read and return 404 if that user has not collected the article.

5. Update `/counts`, `/sources`, `/articles/:id/position`, and any route-local search/query helper in this file so private branches always join/filter on `articleMetadata.userId = userId`. Return public counts only from an explicit public endpoint if the public UI needs them; do not silently count private libraries for a guest.

- [ ] **Step 4: Run the targeted tests and API checks**

Run:

```bash
node --test apps/api/test/phase2-user-scope.test.mjs apps/api/test/phase5-private-publications.test.mjs
pnpm --filter api build
curl -i 'http://localhost:1052/api/v1/articles?view=inbox&page=1&perPage=2'
curl -i 'http://localhost:1052/api/v1/articles?view=published&page=1&perPage=2'
curl -i 'http://localhost:1052/api/v1/articles/1'
curl -i 'http://localhost:1052/api/v1/publications/not-a-real-token'
```

Expected: anonymous inbox and private detail are `403`; public feed is `200`; unknown publication is `404`; both Node tests and API build pass.

- [ ] **Step 5: Commit the article access boundary**

```bash
git add apps/api/src/routes/articles.ts apps/api/test/phase2-user-scope.test.mjs apps/api/test/phase5-private-publications.test.mjs
git commit -m "feat: separate private article reads from public publications"
```

## Task 3: Publish Idempotently, Auto-Archive Before Exposure, and Return a Canonical URL

**Files:**
- Modify: `apps/api/src/routes/articles.ts:400-590`
- Modify: `apps/api/test/phase5-private-publications.test.mjs`

**Interfaces:**
- Consumes: private metadata lookup, `generateSummaryAndTags(articleId, userId)`, article content/cover helpers, and `randomUUID` from `node:crypto`.
- Produces:
  - `POST /articles/:id/publish` response `{ article, publicUrl }`;
  - `POST /articles/:id/unpublish` response `{ article, publicUrl }`;
  - a stable `articleMetadata.publicId` generated only on first publication.

- [ ] **Step 1: Add failing publication-workflow tests**

Append these source-contract tests:

```js
test('publish prepares a private archive before it exposes a public token', () => {
  const routes = read('src/routes/articles.ts');

  assert.match(routes, /import \{ randomUUID \} from 'node:crypto';/);
  assert.match(routes, /generateSummaryAndTags\(id, userId\)/);
  assert.match(routes, /isArchived: true/);
  assert.match(routes, /isPublished: true/);
  assert.match(routes, /publicId: existingMetadata\.publicId \|\| randomUUID\(\)/);
  assert.match(routes, /publicUrl: `\/p\/\$\{published\.publicId\}`/);
});

test('unpublish preserves archive data and hides only the public state', () => {
  const routes = read('src/routes/articles.ts');

  assert.match(routes, /articlesRoutes\.post\('\/articles\/:id\/unpublish', requireAuth/);
  assert.match(routes, /\.set\(\{[\s\S]*isPublished: false/);
  assert.doesNotMatch(routes, /unpublish[\s\S]{0,600}isArchived: false/);
});
```

- [ ] **Step 2: Run the failing workflow test**

Run:

```bash
node --test apps/api/test/phase5-private-publications.test.mjs
```

Expected: FAIL because the current publish endpoint can set publication state without a stable token/canonical response and does not make the archive-readiness invariant explicit.

- [ ] **Step 3: Implement the idempotent publish service flow in the route**

1. Add `import { randomUUID } from 'node:crypto';`.
2. Add a route-local helper that reads current-user metadata and, when `isArchived` is false, executes exactly the existing archive preparations in their existing order with `userId`: content repair/fetch, cover processing, AI summary/tag generation, archive timestamp, and user-scoped Wiki enqueue.
3. Do not set `isPublished` until the helper has returned successfully and the post-processing read confirms the archive metadata has content, `aiSummary`, and `aiTags`.
4. Set publication fields in one metadata update:

```ts
const publicId = existingMetadata.publicId || randomUUID();
await db.update(articleMetadata)
  .set({
    isArchived: true,
    archivedAt: existingMetadata.archivedAt || new Date(),
    isPublished: true,
    publishedAt: new Date(),
    publicId,
    updatedAt: new Date(),
  })
  .where(metadataWhereCondition(id, userId));
```

5. Re-read the row scoped to `userId` and return:

```ts
return c.json({
  article: mapArticleRow(published),
  publicUrl: `/p/${published.publicId}`,
});
```

6. If the row is already published and has `publicId`, skip all archive/AI work and return the same URL.
7. In `unpublish`, change only `isPublished` and `updatedAt`; retain `publicId`, archive content, AI fields, and Wiki records.

- [ ] **Step 4: Run tests, build, and protected live mutation checks**

Run:

```bash
node --test apps/api/test/phase5-private-publications.test.mjs
pnpm --filter api build
```

Use a disposable test article owned by a non-production local user, then verify in order:

```bash
# authenticated publish response contains publicUrl
# unauthenticated GET /api/v1/publications/<publicId> returns 200
# authenticated unpublish succeeds
# unauthenticated GET /api/v1/publications/<publicId> returns 404
# authenticated archive list still contains the article
```

Expected: all contract tests/build pass; unpublish removes only public access.

- [ ] **Step 5: Commit publication behavior**

```bash
git add apps/api/src/routes/articles.ts apps/api/test/phase5-private-publications.test.mjs
git commit -m "feat: publish archived user articles with stable public links"
```

## Task 4: Convert Wiki Persistence and API Reads to User Scope

**Files:**
- Modify: `apps/api/src/db/schema.ts:138-330`
- Modify: `apps/api/src/services/metadata-scope.service.ts:17-220`
- Modify: `apps/api/src/routes/wiki.ts:1-100`
- Modify: `apps/api/src/services/wiki.service.ts`
- Modify: `apps/api/src/services/wiki.worker.ts`
- Modify: `apps/api/test/phase2-user-scope.test.mjs`
- Modify: `apps/api/test/phase5-private-publications.test.mjs`

**Interfaces:**
- Consumes: authenticated `getCurrentUser(c).id`, `articleMetadata` user ownership, and queued Wiki jobs.
- Produces: Wiki service functions that require `{ userId }`, user-owned Wiki persistence, and no guest-accessible Wiki API.

- [ ] **Step 1: Write failing Wiki-scope tests**

Replace the obsolete admin-only assertion in `phase2-user-scope.test.mjs` and add these tests to `phase5-private-publications.test.mjs`:

```js
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
```

- [ ] **Step 2: Run the failing Wiki tests**

Run:

```bash
node --test apps/api/test/phase2-user-scope.test.mjs apps/api/test/phase5-private-publications.test.mjs
```

Expected: FAIL because the current implementation uses global article/page Wiki records and `optionalAuth` routes.

- [ ] **Step 3: Add repeatable Wiki schema migration and indexes**

1. Add `userId` to every Wiki table listed in the approved design. Use `integer('user_id').references(() => users.id)` in Drizzle declarations.
2. In `ensurePrivateLibraryPublicationSchema`, add `user_id` columns with `IF NOT EXISTS` to all Wiki tables.
3. Backfill an unambiguous user only by joining each Wiki row’s `article_id` to `article_metadata`; do not choose an arbitrary owner if multiple metadata rows exist.
4. Mark or delete any legacy Wiki derived row whose ownership cannot be determined unambiguously; it will be regenerated from that user’s archives.
5. Drop the legacy global unique constraints/indexes and create:

```sql
CREATE UNIQUE INDEX IF NOT EXISTS wiki_articles_user_article_unique
ON wiki_articles(user_id, article_id);

CREATE UNIQUE INDEX IF NOT EXISTS wiki_article_extracts_user_article_unique
ON wiki_article_extracts(user_id, article_id);

CREATE UNIQUE INDEX IF NOT EXISTS wiki_pages_user_slug_unique
ON wiki_pages(user_id, slug);
```

6. Add non-unique `user_id` indexes for frequently listed Wiki jobs/log entries and source/relationship tables.

- [ ] **Step 4: Thread `userId` through Wiki route, service, and worker calls**

1. Change every Wiki route to `requireAuth`, derive `userId` once, and call service functions with `{ userId }`.
2. Update each exported Wiki service function to accept a required `userId`. Every select, update, delete, queue, page/source/relationship lookup, graph, search, log and status query must filter the owning Wiki row by that ID.
3. Replace any query that joins `articles` to `articleMetadata` solely on `article_id` with both `article_id` and `articleMetadata.userId = userId`.
4. Include `userId` when enqueueing Wiki jobs. Update `processWikiJobs` and worker processing to select a job with its owner, then call all helpers with the same owner ID.
5. When handling article archive/unarchive/publish, pass `userId` into `enqueueArticleForWiki` and `removeArticleFromWiki` so one user’s unarchive does not delete another user’s Wiki representation of the same global article.

- [ ] **Step 5: Run Wiki regression tests and API authorization probes**

Run:

```bash
node --test apps/api/test/phase2-user-scope.test.mjs apps/api/test/phase5-private-publications.test.mjs
pnpm --filter api build
curl -i http://localhost:1052/api/v1/wiki
curl -i http://localhost:1052/api/v1/wiki/search?q=test
```

Expected: both unauthenticated Wiki requests return `401` or `403`; tests and API build pass.

- [ ] **Step 6: Commit Wiki isolation**

```bash
git add apps/api/src/db/schema.ts apps/api/src/services/metadata-scope.service.ts apps/api/src/routes/wiki.ts apps/api/src/services/wiki.service.ts apps/api/src/services/wiki.worker.ts apps/api/test/phase2-user-scope.test.mjs apps/api/test/phase5-private-publications.test.mjs
git commit -m "feat: scope wiki data and jobs to article owners"
```

## Task 5: Add Published Management, Public Feed, and Canonical Share Behavior in the Web App

**Files:**
- Modify: `apps/web/src/lib/api.ts`
- Modify: `apps/web/src/hooks/useArticleOperations.ts`
- Create: `apps/web/src/components/content/PublishedContent.tsx`
- Create: `apps/web/src/app/(main)/published/page.tsx`
- Create: `apps/web/src/app/published/page.tsx`
- Create: `apps/web/src/app/p/[publicId]/page.tsx`
- Modify: `apps/web/src/components/article/WechatArticleCard.tsx`
- Modify: `apps/web/src/components/article/WechatDetailPanel.tsx`
- Modify: `apps/web/src/components/layout/DesktopTopNav.tsx`
- Modify: `apps/web/src/components/layout/MobileTopNav.tsx`
- Modify: `apps/web/src/app/(main)/layout.tsx`

**Interfaces:**
- Consumes: `api.publish(id) -> { article, publicUrl }`, `api.unpublish(id)`, `api.getPublicPublication(publicId)`, and article fields `isPublished`, `publicId`, `publicUrl`, `publishedAt`.
- Produces: an authenticated published-management Tab, guest-public feed/detail routes, publish/unpublish controls, and share URLs that always use `/p/:publicId`.

- [ ] **Step 1: Extend API types and write compile-failing callers**

1. In `apps/web/src/lib/api.ts`, add to the article type:

```ts
isPublished: boolean;
publicId?: string | null;
publicUrl?: string | null;
publishedAt?: string | null;
```

2. Add client methods:

```ts
publish: (id: number) => fetchJSON<{ article: Article; publicUrl: string }>(`/articles/${id}/publish`, { method: 'POST' }),
unpublish: (id: number) => fetchJSON<{ article: Article; publicUrl: string | null }>(`/articles/${id}/unpublish`, { method: 'POST' }),
getPublicPublication: (publicId: string) => fetchJSON<{ article: Article }>(`/publications/${encodeURIComponent(publicId)}`),
```

3. Create `PublishedContent.tsx` as a typed consumer of `api.getArticles('published', ..., undefined, ..., ..., ..., 'mine')` after extending `getArticles` with an optional `scope` query parameter. The first compile should fail until the client signature and component implementation are aligned.

- [ ] **Step 2: Verify the initial frontend type failure**

Run:

```bash
pnpm --filter web build
```

Expected: FAIL until the `getArticles` scope parameter and publication response types are implemented consistently.

- [ ] **Step 3: Implement the published-management Tab and public routes**

1. Reuse `ArchiveContent` list/filter/sort composition in `PublishedContent`, but request `view=published&scope=mine` and use a publication-aware title/copy.
2. Add the authenticated route `/published` under `(main)` and link it in both top-nav variants when authenticated.
3. Add the guest-safe public feed route outside `(main)`. It calls `api.getArticles('published')` and renders publication cards without favorite/archive/private controls.
4. Add `/p/[publicId]` outside `(main)`. Fetch with `api.getPublicPublication(publicId)` and render public title, cover, byline, publication time, AI summary, category, tags, and article content. Render an explicit not-found state for a 404 response.
5. Ensure the private main layout/nav does not expose inbox, favorites, archive, Wiki, settings, or admin actions to a guest. Keep a visible published feed/login path.

- [ ] **Step 4: Implement publish/unpublish and share mutation behavior**

1. In `useArticleOperations.ts`, add mutation functions that call `api.publish` / `api.unpublish`, update `ArticleContext` by article ID, and revalidate affected inbox/favorite/archive/published views.
2. In `WechatArticleCard.tsx` and the authenticated `WechatDetailPanel` footer, add a publish/unpublish control. Disable it while the corresponding mutation is pending and label states accurately (`发布中`, `发布`, `取消发布`).
3. Replace the existing share URL generation in `WechatDetailPanel.tsx` with:

```ts
const result = article.isPublished && article.publicUrl
  ? { publicUrl: article.publicUrl }
  : await api.publish(article.id);
const shareUrl = new URL(result.publicUrl, window.location.origin).toString();
await navigator.clipboard.writeText(shareUrl);
```

4. Use the same `shareUrl` for the poster and Web Share API. If publication fails, keep the private link hidden and show the returned error through the existing toast mechanism.

- [ ] **Step 5: Run web checks and manually verify the UI flow**

Run:

```bash
pnpm --filter web build
pnpm lint
```

Then verify in the local browser:

1. Logged-in user sees the Published Tab and only their own published records.
2. A private inbox article can be published and moves/appears in the Published Tab while remaining archived.
3. Share copies a URL beginning with `http://localhost:1050/p/`.
4. In a logged-out browser session, `/published` and that `/p/<token>` URL render, while `/inbox`, `/archive`, and `/wiki` do not expose data.
5. After unpublish, the public link renders not-found and the private archive remains available to its owner.

- [ ] **Step 6: Commit the web experience**

```bash
git add apps/web/src/lib/api.ts apps/web/src/hooks/useArticleOperations.ts apps/web/src/components/content/PublishedContent.tsx apps/web/src/app/'(main)'/published/page.tsx apps/web/src/app/published/page.tsx apps/web/src/app/p/'[publicId]'/page.tsx apps/web/src/components/article/WechatArticleCard.tsx apps/web/src/components/article/WechatDetailPanel.tsx apps/web/src/components/layout/DesktopTopNav.tsx apps/web/src/components/layout/MobileTopNav.tsx apps/web/src/app/'(main)'/layout.tsx
git commit -m "feat: manage and share public article publications"
```

## Task 6: End-to-End Authorization Regression and Completion Verification

**Files:**
- Modify: `apps/api/test/phase5-private-publications.test.mjs`
- Modify: `docs/superpowers/specs/2026-07-16-private-library-publications-design.md` only if implementation reveals and resolves a material design ambiguity.

**Interfaces:**
- Consumes: complete API, migration, and web behavior from Tasks 1–5.
- Produces: final evidence that private collections/Wiki remain isolated, public URLs work only while published, and no existing article-list request still fails from schema drift.

- [ ] **Step 1: Add final failing regression assertions for the authorization boundary**

Add assertions that require all of these contract markers:

```js
test('guest paths are limited to public publication APIs and authenticated Wiki routes', () => {
  const articleRoutes = read('src/routes/articles.ts');
  const wikiRoutes = read('src/routes/wiki.ts');

  assert.match(articleRoutes, /view !== 'published'/);
  assert.match(articleRoutes, /articlesRoutes\.get\('\/publications\/:publicId', optionalAuth/);
  assert.match(wikiRoutes, /wikiRoutes\.get\('\/wiki', requireAuth/);
  assert.doesNotMatch(articleRoutes, /Check if published by any user/);
});
```

- [ ] **Step 2: Run the regression test and observe its initial failure if any contract is missing**

Run:

```bash
node --test apps/api/test/phase5-private-publications.test.mjs
```

Expected: PASS only after Tasks 1–5; any failure identifies a remaining contract gap before release.

- [ ] **Step 3: Fix only any contract gap reported by the new test**

For each failure, trace the relevant route/service to the missing user filter or public-only predicate. Add the smallest missing `userId` condition or `isPublished/publicId` predicate; do not refactor unrelated code in this task.

- [ ] **Step 4: Run the full verification matrix**

Run:

```bash
node --test apps/api/test/*.test.mjs
pnpm --filter api build
pnpm --filter web build
pnpm lint
curl -fsS http://localhost:1052/api/v1/health
curl -i 'http://localhost:1052/api/v1/articles?view=published&page=1&perPage=8'
curl -i 'http://localhost:1052/api/v1/articles?view=inbox&page=1&perPage=8'
curl -i 'http://localhost:1052/api/v1/wiki'
```

Expected:

- all Node tests, API build, web build, and lint pass;
- health and public feed return `200`;
- anonymous inbox and Wiki return `401` or `403`;
- API logs contain no `article_metadata.is_published does not exist` error.

- [ ] **Step 5: Commit final regression coverage**

```bash
git add apps/api/test/phase5-private-publications.test.mjs docs/superpowers/specs/2026-07-16-private-library-publications-design.md
git commit -m "test: cover private library publication boundaries"
```
