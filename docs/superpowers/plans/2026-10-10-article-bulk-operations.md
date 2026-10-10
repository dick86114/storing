# 文章批量操作 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Web 端为四大文章列表提供统一的批量状态操作、AI 任务、发布控制和 ZIP/Obsidian 导出。

**Architecture:** 后端先建立共享契约和可测试的批量服务，普通元数据操作走批量 SQL，发布、彻底删除和 AI 触发沿用现有逐篇事务/队列语义；导出使用独立任务表和文件流。前端抽取选择 Hook 与批量操作栏，再接入收件箱、收藏、归档和已发布列表。

**Tech Stack:** Hono、Drizzle ORM、PostgreSQL、`archiver`、Next.js App Router、React 19、SWR、Node.js test runner。

**Spec:** [docs/superpowers/specs/2026-10-10-article-bulk-operations-design.md](../specs/2026-10-10-article-bulk-operations-design.md)

## Global Constraints

- 永远使用中文回答；项目注释、文档和用户可见文案使用中文。
- 前端依赖和脚本使用 `pnpm`，不使用 `npm`。
- 首期只实现 Web 端入口；Android 与 macOS 留到第二阶段。
- 批量接口单次最多 200 篇文章。
- `favorite | unfavorite | archive | unarchive | delete | permanent_delete | publish | unpublish` 通过 `POST /api/v1/articles/bulk-actions` 分发。
- 批量结果必须包含 `requestedCount`、`succeededIds`、`skipped`、`failed`；发布成功项额外返回 `publications`。
- 不直接写入用户 Obsidian 保管库，只生成可导入 ZIP。
- 首期导出图片保留远程 URL，不下载附件。
- 普通删除必须强确认；彻底删除必须强确认且明确不可恢复。
- 取消发布保留归档状态、归档时间和 `publicId`。

## Review Focus

- 跨用户文章 ID：批量操作只能影响当前用户元数据；由 Task 2 的用户隔离测试覆盖。
- 重复发布：已发布文章必须跳过且不得刷新发布时间或更换 `publicId`；由 Task 4 的发布复用测试覆盖。
- 恶意标题或分类名：导出路径不得逃逸 ZIP 根目录；由 Task 6 的路径清理测试覆盖。
- 共享原文并发删除：彻底删除必须加行锁并在仍有其他引用时只删除当前用户元数据；由 Task 3 的事务契约测试覆盖。
- 移动端批量工具栏：320px 视口下动作必须可横向滚动且不得遮挡列表；由 Task 11 的样式契约测试覆盖。

---

## File Structure

- `packages/shared/src/types.ts`：批量操作、AI 提交和导出任务的跨端类型。
- `apps/api/src/services/article-bulk.service.ts`：批量输入校验、状态操作、发布与删除编排。
- `apps/api/src/routes/articles.ts`：暴露批量端点，只做 HTTP 参数与响应转换。
- `apps/api/src/services/article-bulk-export.ts`：纯 Markdown/frontmatter/安全路径生成。
- `apps/api/src/services/bulk-export-job.service.ts`：导出任务表、生成、查询、下载和清理。
- `apps/web/src/hooks/useArticleSelection.ts`：列表选择状态。
- `apps/web/src/hooks/useBulkArticleActions.ts`：调用批量 API 并刷新缓存。
- `apps/web/src/components/article/BulkActionBar.tsx`：动作、确认、导出与结果 UI。
- `apps/web/src/components/content/*Content.tsx`：接入统一批量入口。

### Task 1: 契约类型与输入归一化

**Files:**

- Modify: `packages/shared/src/types.ts`
- Create: `apps/api/src/services/article-bulk-validation.ts`
- Test: `apps/api/test/article-bulk-validation.test.ts`

**Interfaces:**

- Consumes: 无。
- Produces:
  - `export type ArticleBulkAction = 'favorite' | 'unfavorite' | 'archive' | 'unarchive' | 'delete' | 'permanent_delete' | 'publish' | 'unpublish'`
  - `export interface ArticleBulkIssue { articleId: number; code: string; message?: string }`
  - `export interface ArticleBulkActionResult { requestedCount: number; succeededIds: number[]; skipped: ArticleBulkIssue[]; failed: ArticleBulkIssue[]; publications?: Array<{ articleId: number; publicUrl: string }> }`
  - `export interface ArticleBulkAiResult { requestedCount: number; queuedIds: number[]; alreadyQueuedIds: number[]; failed: ArticleBulkIssue[] }`
  - `export type BulkExportFormat = 'zip' | 'obsidian'`
  - `export type BulkExportStatus = 'queued' | 'running' | 'succeeded' | 'failed'`
  - `export interface BulkExportJob { id: number; format: BulkExportFormat; status: BulkExportStatus; requestedCount: number; succeededCount: number; failedCount: number; downloadUrl: string | null; createdAt: string; finishedAt: string | null; expiresAt: string | null }`
  - `export function parseArticleBulkActionInput(body: unknown): { ok: true; action: ArticleBulkAction; articleIds: number[] } | { ok: false; code: 'INVALID_ACTION' | 'EMPTY_ARTICLES' | 'INVALID_ARTICLES' | 'TOO_MANY_ARTICLES' }`

- [ ] **Step 1: Write the failing test**

Create `apps/api/test/article-bulk-validation.test.ts` with tests:

```ts
test('归一化重复文章 ID 并保持正整数', () => {
  assert.deepEqual(parseArticleBulkActionInput({
    action: 'favorite',
    articleIds: [3, 1, 3, '2'],
  }), { ok: true, action: 'favorite', articleIds: [3, 1, 2] });
});

test('拒绝未知动作、空列表、非法 ID 和超过 200 篇', () => {
  assert.equal(parseArticleBulkActionInput({ action: 'destroy', articleIds: [1] }).ok, false);
  assert.equal(parseArticleBulkActionInput({ action: 'favorite', articleIds: [] }).ok, false);
  assert.equal(parseArticleBulkActionInput({ action: 'favorite', articleIds: [0] }).ok, false);
  assert.equal(parseArticleBulkActionInput({ action: 'favorite', articleIds: Array.from({ length: 201 }, (_, i) => i + 1) }).ok, false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && pnpm exec node --import tsx --test test/article-bulk-validation.test.ts`

Expected: FAIL，因为 `parseArticleBulkActionInput` 不存在。

- [ ] **Step 3: Implement the contract and parser**

Add shared types to `packages/shared/src/types.ts`. Implement `parseArticleBulkActionInput` with a literal action set, `Set` deduplication, positive integer filtering is not allowed for invalid entries: any non-positive-integer entry must return `INVALID_ARTICLES`; exact article limit is `200`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && pnpm exec node --import tsx --test test/article-bulk-validation.test.ts`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add packages/shared/src/types.ts apps/api/src/services/article-bulk-validation.ts apps/api/test/article-bulk-validation.test.ts
git commit -m "feat: add article bulk operation contract"
```

### Task 2: 普通批量元数据服务与端点

**Files:**

- Create: `apps/api/src/services/article-bulk.service.ts`
- Modify: `apps/api/src/routes/articles.ts`
- Test: `apps/api/test/article-bulk-actions-route.test.mjs`

**Interfaces:**

- Consumes: Task 1 的 `parseArticleBulkActionInput` 与 `ArticleBulkActionResult`。
- Produces:
  - `export type SimpleArticleBulkAction = 'favorite' | 'unfavorite' | 'archive' | 'unarchive' | 'delete'`
  - `export interface OwnedArticleBulkRecord { articleId: number; isFavorited: boolean; isArchived: boolean; isDeleted: boolean; aiSummary: string | null; aiTags: string[] | null }`
  - `export async function runSimpleArticleBulkAction(userId: number, action: SimpleArticleBulkAction, articleIds: number[]): Promise<ArticleBulkActionResult>`
  - Route: `POST /articles/bulk-actions`，请求体为 `{ action, articleIds }`。

- [ ] **Step 1: Write the failing contract test**

Create `apps/api/test/article-bulk-actions-route.test.mjs`. Add test `普通批量端点保持用户隔离和目标状态语义`:

```js
assert.match(routes, /articlesRoutes\.post\('\/articles\/bulk-actions', requireAuth/);
assert.match(service, /export async function runSimpleArticleBulkAction/);
assert.match(service, /eq\(articleMetadata\.userId, userId\)/);
assert.match(service, /ALREADY_FAVORITED/);
assert.match(service, /ALREADY_ARCHIVED/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && node --test test/article-bulk-actions-route.test.mjs`

Expected: FAIL，缺少端点和服务导出。

- [ ] **Step 3: Implement `runSimpleArticleBulkAction(userId: number, action: SimpleArticleBulkAction, articleIds: number[]): Promise<ArticleBulkActionResult>`**

查询当前用户的元数据记录，不存在的 ID 记为 `NOT_FOUND`；已处于目标状态的 ID 记为 `ALREADY_*`。剩余 ID 按目标状态分组批量更新：收藏写 `favorited_at`，取消收藏清空它；归档设置 `archived_at` 和“待整理”分类，随后逐篇调用现有 `queueArchiveAiIfNeeded` 与 `processCoverImage`；删除只设置 `is_deleted = true`。

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && node --test test/article-bulk-actions-route.test.mjs && pnpm exec node --import tsx --test test/article-bulk-validation.test.ts`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services/article-bulk.service.ts apps/api/src/routes/articles.ts apps/api/test/article-bulk-actions-route.test.mjs
git commit -m "feat: add simple article bulk actions"
```

### Task 3: 批量彻底删除与共享引用安全

**Files:**

- Modify: `apps/api/src/services/article-bulk.service.ts`
- Modify: `apps/api/src/routes/articles.ts`
- Modify: `apps/api/test/article-bulk-actions-route.test.mjs`

**Interfaces:**

- Consumes: Task 2 的批量结果结构与所有权查询。
- Produces:
  - `export type PermanentDeleteScope = 'permanent' | 'metadata' | 'not_found'`
  - `export async function permanentlyDeleteArticleForUser(userId: number, articleId: number): Promise<Exclude<PermanentDeleteScope, 'not_found'>>`
  - `runSimpleArticleBulkAction` 现在接受 `permanent_delete`。

- [ ] **Step 1: Write the failing test**

Add test `批量彻底删除逐篇使用行锁和引用判断`:

```js
const service = readApi('src/services/article-bulk.service.ts');
assert.match(service, /export async function permanentlyDeleteArticleForUser/);
assert.match(service, /\.for\('update'\)/);
assert.match(service, /COUNT\(\*\)/);
assert.match(service, /is_deleted = true|isDeleted: true/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && node --test test/article-bulk-actions-route.test.mjs`

Expected: FAIL，缺少 `permanentlyDeleteArticleForUser`。

- [ ] **Step 3: Extract and reuse the existing single-article permanent transaction**

Move the existing `/articles/:id/permanent` transaction into `permanentlyDeleteArticleForUser`; lock `articles` row, count other users' metadata, retain shared原文 when count > 0, otherwise clean collect job/admin audit references before deleting metadata and article. Route and bulk action both call it.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/api && node --test test/article-bulk-actions-route.test.mjs`

Expected: PASS，包括原有 single permanent 行为断言。

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services/article-bulk.service.ts apps/api/src/routes/articles.ts apps/api/test/article-bulk-actions-route.test.mjs
git commit -m "feat: add safe bulk permanent deletion"
```

### Task 4: 批量发布与取消发布

**Files:**

- Modify: `apps/api/src/services/article-bulk.service.ts`
- Modify: `apps/api/src/routes/articles.ts`
- Modify: `apps/api/test/article-bulk-actions-route.test.mjs`

**Interfaces:**

- Consumes: Task 2 服务结构和 `getArticleContent`、`getPendingCategory`。
- Produces:
  - `export type ArticlePublishOutcome = { status: 'succeeded'; publicUrl: string } | { status: 'skipped'; code: 'ALREADY_PUBLISHED' } | { status: 'failed'; code: string; message: string }`
  - `export type ArticleUnpublishOutcome = { status: 'succeeded' } | { status: 'skipped'; code: 'ALREADY_UNPUBLISHED' }`
  - `export async function publishArticleForUser(userId: number, articleId: number): Promise<ArticlePublishOutcome>`
  - `export async function unpublishArticleForUser(userId: number, articleId: number): Promise<ArticleUnpublishOutcome>`
  - `runSimpleArticleBulkAction` 现在接受 `publish | unpublish`，成功发布项写入 `publications`。

- [ ] **Step 1: Write the failing tests**

Add tests `批量发布保留已有公开链接` and `批量取消发布保留归档和 publicId`:

```js
const publish = extractRoute("articlesRoutes.post('/articles/bulk-actions'");
assert.match(publish, /publications/);
assert.match(service, /ALREADY_PUBLISHED/);
assert.match(service, /isPublished: false/);
assert.match(service, /archivedAt/);
assert.match(service, /publicId/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && node --test test/article-bulk-actions-route.test.mjs`

Expected: FAIL，缺少 publish/unpublish 批量分支。

- [ ] **Step 3: Implement publication service functions**

`publishArticleForUser` mirrors the existing single publish semantics: already published with `publicId` returns `ALREADY_PUBLISHED`; unarchived article requires readable Markdown and auto-archives to“待整理”; new publication sets `published_at` and a stable UUID `public_id`. `unpublishArticleForUser` only sets `is_published = false` and keeps archive fields and `public_id`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/api && node --test test/article-bulk-actions-route.test.mjs test/ai-trigger-policy.test.mjs`

Expected: PASS；发布不新增 AI 依赖，且保留 `BODY_NOT_READY`。

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services/article-bulk.service.ts apps/api/src/routes/articles.ts apps/api/test/article-bulk-actions-route.test.mjs
git commit -m "feat: add bulk publish controls"
```

### Task 5: 批量分类、重判分类与 AI 提交

**Files:**

- Modify: `apps/api/src/services/article-bulk.service.ts`
- Modify: `apps/api/src/routes/articles.ts`
- Modify: `apps/api/test/article-bulk-actions-route.test.mjs`

**Interfaces:**

- Consumes: `enqueueAiGeneration`、`resolveUserAiRuntimeConfig`、`moveArticlesToCategory`、`ArticleBulkAiResult`。
- Produces:
  - `export async function runBulkArticleCategory(userId: number, articleIds: number[], categoryId: number): Promise<ArticleBulkActionResult>`
  - `export async function enqueueBulkArticleAi(userId: number, articleIds: number[], options: { includeCategory: boolean }): Promise<ArticleBulkAiResult>`
  - `POST /articles/bulk-category` 响应升级为 `ArticleBulkActionResult`。
  - Route: `POST /articles/bulk-regenerate-ai`，body 为 `{ articleIds, includeCategory?: boolean }`。
  - `includeCategory: true` 用于批量重判分类；`false` 用于只生成摘要和标签。

- [ ] **Step 1: Write the failing test**

Add tests `批量分类返回统一结果结构` and `批量 AI 先校验配置并避免重复排队`:

```js
assert.match(service, /export async function runBulkArticleCategory/);
assert.match(routes, /runBulkArticleCategory/);
assert.match(routes, /articlesRoutes\.post\('\/articles\/bulk-regenerate-ai', requireAuth/);
assert.match(service, /export async function enqueueBulkArticleAi/);
assert.match(service, /resolveUserAiRuntimeConfig\(userId\)/);
assert.match(service, /status IN \('queued', 'running'\)|IN \('queued', 'running'\)/);
assert.match(service, /alreadyQueuedIds/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && node --test test/article-bulk-actions-route.test.mjs`

Expected: FAIL，缺少 `enqueueBulkArticleAi`。

- [ ] **Step 3: Implement queue submission**

For category assignment, validate positive category ownership through the existing category service, load owned article IDs first, call `moveArticlesToCategory`, and return moved IDs in `succeededIds`. Then implement AI submission: resolve the user's AI runtime config; if missing return an `AI_NOT_CONFIGURED` HTTP error without creating jobs. Load owned records, mark archived/ownership failures as skipped or failed, query active jobs into `alreadyQueuedIds`, then call `enqueueAiGeneration` once per eligible article. For reclassification require `isArchived` and `categorySource !== 'user'`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/api && pnpm exec node --import tsx --test test/article-bulk-validation.test.ts && node --test test/article-bulk-actions-route.test.mjs test/archive-bulk-classify-contract.test.mjs`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services/article-bulk.service.ts apps/api/src/routes/articles.ts apps/api/test/article-bulk-actions-route.test.mjs
git commit -m "feat: queue bulk article AI generation"
```

### Task 6: Obsidian 导出文档生成器

**Files:**

- Create: `apps/api/src/services/article-bulk-export.ts`
- Test: `apps/api/test/article-bulk-export.test.ts`

**Interfaces:**

- Consumes: Task 1 的 `BulkExportFormat`。
- Produces:
  - `export interface BulkExportArticleInput { articleId: number; title: string; author: string | null; source: string | null; originalUrl: string | null; publishedAt: Date | string | null; savedAt: Date | string | null; categoryName: string | null; aiSummary: string | null; aiTags: string[] | null; contentMd: string | null }`
  - `export function sanitizeExportPathSegment(value: string, fallback: string): string`
  - `export function buildExportEntryPath(article: BulkExportArticleInput, usedPaths: Set<string>): string`
  - `export function buildObsidianMarkdown(article: BulkExportArticleInput): string`
  - `export function buildExportManifest(format: BulkExportFormat, articles: BulkExportArticleInput[], failures: ArticleBulkIssue[]): string`

- [ ] **Step 1: Write the failing test**

Create `apps/api/test/article-bulk-export.test.ts` with tests:

```ts
test('清理路径分隔符并防止路径逃逸', () => {
  assert.equal(sanitizeExportPathSegment('../../evil', '未命名'), '.._.._evil');
  assert.equal(sanitizeExportPathSegment('a/b\\c', '未命名'), 'a_b_c');
});

test('Obsidian Markdown 包含 frontmatter 和正文', () => {
  const markdown = buildObsidianMarkdown({ articleId: 12, title: '标题: "引用"', contentMd: '# 正文', aiTags: ['AI', '阅读'] });
  assert.match(markdown, /^---\n/);
  assert.match(markdown, /title:/);
  assert.match(markdown, /storing_id: 12/);
  assert.match(markdown, /# 正文/);
});
```

Also assert duplicate titles receive `-12`, and `manifest.json` includes every requested article ID.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && pnpm exec node --import tsx --test test/article-bulk-export.test.ts`

Expected: FAIL，模块不存在。

- [ ] **Step 3: Implement the pure export builder**

Replace `/`、`\`、control characters and reserved traversal sequences in each path segment; append the article ID before `.md`; keep a `usedPaths` set for deduplication. YAML strings use `JSON.stringify` escaping. Manifest contains export format, generated time, article IDs, paths and failures.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/api && pnpm exec node --import tsx --test test/article-bulk-export.test.ts`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services/article-bulk-export.ts apps/api/test/article-bulk-export.test.ts
git commit -m "feat: build bulk Obsidian export documents"
```

### Task 7: 导出任务、ZIP 下载与过期清理

**Files:**

- Modify: `apps/api/package.json`
- Modify: `apps/api/src/db/schema.ts`
- Create: `apps/api/src/services/bulk-export-job.service.ts`
- Modify: `apps/api/src/routes/articles.ts`
- Modify: `apps/api/src/index.ts`
- Test: `apps/api/test/bulk-export-job.test.mjs`

**Interfaces:**

- Consumes: Task 6 的导出生成器、`BULK_EXPORT_FORMATS`。
- Produces:
  - `export async function ensureBulkExportSchema(): Promise<void>`
  - `export async function createBulkExportJob(userId: number, input: { articleIds: number[]; format: BulkExportFormat; includeAi: boolean; organizeByCategory: boolean }): Promise<BulkExportJob>`
  - `export async function getBulkExportJob(userId: number, jobId: number): Promise<BulkExportJob | null>`
  - `export async function runBulkExportJob(jobId: number): Promise<void>`
  - `export async function openBulkExportDownload(userId: number, jobId: number): Promise<{ stream: Readable; filename: string; size: number } | null>`
  - `export async function cleanupExpiredBulkExportJobs(): Promise<void>`
  - Routes: `POST /articles/bulk-export`、`GET /articles/bulk-export/:jobId`、`GET /articles/bulk-export/:jobId/download`。

- [ ] **Step 1: Add the failing dependency and contract test**

Run `pnpm --filter api add archiver && pnpm --filter api add -D @types/archiver`, then add the resulting dependency changes to git. Create `apps/api/test/bulk-export-job.test.mjs`:

```js
test('导出任务路由只允许创建者访问并流式下载 ZIP', () => {
  const routes = readApi('src/routes/articles.ts');
  const service = readApi('src/services/bulk-export-job.service.ts');
  assert.match(routes, /articlesRoutes\.post\('\/articles\/bulk-export', requireAuth/);
  assert.match(routes, /articlesRoutes\.get\('\/articles\/bulk-export\/:jobId\/download', requireAuth/);
  assert.match(service, /eq\(bulkExportJobs\.userId, userId\)/);
  assert.match(service, /Content-Disposition/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/api && node --test test/bulk-export-job.test.mjs`

Expected: FAIL，缺少表、服务和路由。

- [ ] **Step 3: Implement schema, job service and startup hookup**

Add `bulkExportJobs` with fields from the spec; use `TEXT` status and owner cascade delete. Job files go under `${os.tmpdir()}/storing-bulk-exports`, expire after `24` hours, and are removed by cleanup. `runBulkExportJob` loads current-user-owned, non-deleted articles, builds Markdown via Task 6, writes with `archiver`, updates counts and failures, and never writes outside the job file.

- [ ] **Step 4: Wire HTTP routes and startup initialization**

POST creates a job and returns `BulkExportJob`; GET returns job status; download sets `application/zip`, `Content-Disposition` and streams only after ownership lookup. Call `ensureBulkExportSchema` and `cleanupExpiredBulkExportJobs` during API startup.

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd apps/api && node --test test/bulk-export-job.test.mjs && pnpm exec node --import tsx --test test/article-bulk-export.test.ts`

Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add apps/api/package.json pnpm-lock.yaml apps/api/src/db/schema.ts apps/api/src/services/bulk-export-job.service.ts apps/api/src/routes/articles.ts apps/api/src/index.ts apps/api/test/bulk-export-job.test.mjs
git commit -m "feat: add bulk export jobs"
```

### Task 8: Web API 客户端与选择状态

**Files:**

- Modify: `apps/web/src/lib/api.ts`
- Create: `apps/web/src/hooks/useArticleSelection.ts`
- Create: `apps/web/src/hooks/useBulkArticleActions.ts`
- Test: `apps/web/test/article-bulk-operations.test.mjs`

**Interfaces:**

- Consumes: `@storing/shared` 的批量契约类型。
- Produces:
  - `api.bulkArticles(action: ArticleBulkAction, articleIds: number[]): Promise<ArticleBulkActionResult>`
  - `api.bulkSetCategory(articleIds: number[], categoryId: number): Promise<ArticleBulkActionResult>`
  - `api.bulkRegenerateArticleAi(articleIds: number[], includeCategory: boolean): Promise<ArticleBulkAiResult>`
  - `api.createBulkExport(input: { articleIds: number[]; format: BulkExportFormat; includeAi: boolean; organizeByCategory: boolean }): Promise<BulkExportJob>`
  - `api.getBulkExport(jobId: number): Promise<BulkExportJob>`
  - `export function useArticleSelection(articleIds: number[]): { selectedIds: Set<number>; hasSelection: boolean; isSelected: (id: number) => boolean; toggle: (id: number) => void; selectAllLoaded: () => void; invert: () => void; remove: (ids: Iterable<number>) => void; clear: () => void }`
  - `export function useBulkArticleActions(): { runAction: (action: ArticleBulkAction, ids: number[]) => Promise<ArticleBulkActionResult | null>; runAi: (ids: number[], includeCategory: boolean) => Promise<ArticleBulkAiResult | null>; createExport: (...) => Promise<BulkExportJob | null>; loadingAction: ArticleBulkAction | 'ai' | 'export' | null }`

- [ ] **Step 1: Write the failing test**

Create `apps/web/test/article-bulk-operations.test.mjs`:

```js
test('批量客户端提供统一 API 和选择方法', () => {
  assert.match(api, /bulkArticles: \(action: ArticleBulkAction, articleIds: number\[\]\)/);
  assert.match(api, /bulkSetCategory/);
  assert.match(api, /bulkRegenerateArticleAi/);
  assert.match(api, /createBulkExport/);
  assert.match(selection, /export function useArticleSelection/);
  assert.match(selection, /selectAllLoaded/);
  assert.match(actions, /export function useBulkArticleActions/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && node --test test/article-bulk-operations.test.mjs`

Expected: FAIL，方法和 Hook 不存在。

- [ ] **Step 3: Implement API methods and hooks**

Selection uses `Set<number>`, preserves IDs across appends, and `remove` drops deleted IDs. Action hook calls the new APIs, invalidates the current list key, `/counts`, and detail SWR cache; it never catches validation errors into a false success.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && node --test test/article-bulk-operations.test.mjs test/archive-bulk-category-assignment.test.mjs`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/lib/api.ts apps/web/src/hooks/useArticleSelection.ts apps/web/src/hooks/useBulkArticleActions.ts apps/web/test/article-bulk-operations.test.mjs
git commit -m "feat: add web bulk article clients"
```

### Task 9: 批量操作栏、确认与结果 UI

**Files:**

- Create: `apps/web/src/components/article/BulkActionBar.tsx`
- Modify: `apps/web/src/app/globals.css`
- Test: `apps/web/test/article-bulk-operations.test.mjs`

**Interfaces:**

- Consumes: Task 8 的 Hook 和契约类型。
- Produces:
  - `export type BulkToolbarAction = ArticleBulkAction | 'set-category' | 'reclassify' | 'generate-ai' | 'export-zip' | 'export-obsidian'`
  - `export interface BulkActionBarProps { view: 'inbox' | 'favorites' | 'archive' | 'published'; selectedCount: number; loading: boolean; onToggleMode: () => void; onAction: (action: BulkToolbarAction) => void; onResultClose: () => void; result: ArticleBulkActionResult | ArticleBulkAiResult | null }`
  - Component text: `批量操作`、`全选`、`反选`、`确认彻底删除`、`批量结果`。

- [ ] **Step 1: Write the failing UI contract test**

Add tests:

```js
test('批量操作栏区分普通删除和彻底删除确认', () => {
  assert.match(actionBar, /批量操作/);
  assert.match(actionBar, /确认删除/);
  assert.match(actionBar, /确认彻底删除/);
  assert.match(actionBar, /不可恢复/);
});

test('批量结果展示成功、跳过、失败和公开链接', () => {
  assert.match(actionBar, /成功/);
  assert.match(actionBar, /跳过/);
  assert.match(actionBar, /失败/);
  assert.match(actionBar, /publications/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && node --test test/article-bulk-operations.test.mjs`

Expected: FAIL，组件不存在。

- [ ] **Step 3: Implement actions, dialogs and responsive toolbar**

Actions show a compact button set in edit mode. `delete` and `permanent_delete` open confirmation dialogs before calling `onAction`. Export actions open format options and submit through `onAction`. Result dialog renders counts and issue lists; publication links are anchors. Toolbar uses horizontal scroll below 640px and never overlays list content.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && node --test test/article-bulk-operations.test.mjs`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/article/BulkActionBar.tsx apps/web/src/app/globals.css apps/web/test/article-bulk-operations.test.mjs
git commit -m "feat: add bulk action toolbar"
```

### Task 10: 列表卡片批量点击行为

**Files:**

- Modify: `apps/web/src/components/article/ArticleList.tsx`
- Modify: `apps/web/src/components/article/WechatArticleCard.tsx`
- Modify: `apps/web/test/article-bulk-operations.test.mjs`

**Interfaces:**

- Consumes: 现有 `selectable`、`selected`、`onSelectionChange` props。
- Produces:
  - 批量模式下点击卡片主体调用 `onSelectionChange(article.id, !selected, event)`。
  - 非批量模式保留打开详情行为。

- [ ] **Step 1: Write the failing test**

Add test `批量模式点击卡片主体切换选择`:

```js
assert.match(articleCard, /selectable \? onCardClick/);
assert.match(articleCard, /onSelectionChange\?\.\(article\.id, !selected/);
assert.match(articleCard, /event\.stopPropagation\(\)/);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && node --test test/article-bulk-operations.test.mjs`

Expected: FAIL，批量模式主体仍走 `onClick(article.id)`。

- [ ] **Step 3: Implement selection-first card click**

For both grid and row layouts, when `selectable` is true, the card body click invokes selection toggle and stops propagation. Select checkbox behavior remains unchanged.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/web && node --test test/article-bulk-operations.test.mjs test/archive-bulk-category-assignment.test.mjs`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/article/ArticleList.tsx apps/web/src/components/article/WechatArticleCard.tsx apps/web/test/article-bulk-operations.test.mjs
git commit -m "fix: make bulk card clicks toggle selection"
```

### Task 11: 接入四个列表并迁移归档批量逻辑

**Files:**

- Modify: `apps/web/src/components/content/ArchiveContent.tsx`
- Modify: `apps/web/src/components/content/InboxContent.tsx`
- Modify: `apps/web/src/components/content/FavoritesContent.tsx`
- Modify: `apps/web/src/components/content/PublishedContent.tsx`
- Modify: `apps/web/src/components/article/ListToolbar.tsx`（如需容纳批量控件）
- Modify: `apps/web/test/article-bulk-operations.test.mjs`

**Interfaces:**

- Consumes: Task 8 Hook、Task 9 操作栏、Task 10 卡片行为。
- Produces:
  - `ArchiveContent` 不再直接持有 `bulkMode`、`selectedArticleIds` 和 `bulkSaving`。
  - 每个登录列表把 `allArticles.map(article => article.id)` 传给 `useArticleSelection`。
  - 批量模式时 `ArticleList` 设置 `selectable` 并传入选择集。

- [ ] **Step 1: Write the failing page contract test**

Add test `四个列表复用统一批量操作栏`:

```js
for (const file of ['InboxContent.tsx', 'FavoritesContent.tsx', 'ArchiveContent.tsx', 'PublishedContent.tsx']) {
  assert.match(source(file), /useArticleSelection/);
  assert.match(source(file), /<BulkActionBar/);
  assert.match(source(file), /selectable=\{bulkMode\}/);
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/web && node --test test/article-bulk-operations.test.mjs`

Expected: FAIL，至少三个列表未接入。

- [ ] **Step 3: Replace archive-only state and wire all views**

Use the shared selection Hook and action Hook. Available actions follow the spec: inbox gets favorite/archive/delete/AI/publish/export; favorites gets unfavorite/archive/delete/AI/publish/export; archive gets category/reclassify/AI/favorite/unfavorite/archive controls/delete/publish controls/export; published mine gets unpublish/delete/export. Guests never see the toolbar. Filter changes clear selection after a confirmation prompt.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/web && node --test test/article-bulk-operations.test.mjs test/archive-bulk-category-assignment.test.mjs test/archive-tag-filter.test.mjs`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/content apps/web/src/components/article/ListToolbar.tsx apps/web/test/article-bulk-operations.test.mjs
git commit -m "feat: wire bulk actions into article lists"
```

### Task 12: 全量验证与修复

**Files:**

- Modify: 允许修改前序任务引入的任意相关文件。

**Interfaces:**

- Consumes: Task 1 到 Task 11 的全部交付物。
- Produces: 可合并的最终分支状态。

- [ ] **Step 1: Run API focused tests**

Run: `cd apps/api && pnpm exec node --import tsx --test test/article-bulk-validation.test.ts test/article-bulk-export.test.ts && node --test test/article-bulk-actions-route.test.mjs test/bulk-export-job.test.mjs test/ai-trigger-policy.test.mjs test/phase2-user-scope.test.mjs`

Expected: PASS。

- [ ] **Step 2: Run Web tests**

Run: `cd apps/web && node --test test/*.test.mjs`

Expected: PASS。

- [ ] **Step 3: Run type build**

Run: `pnpm build`

Expected: PASS，无 TypeScript 或 Next.js 构建错误。

- [ ] **Step 4: Run lint**

Run: `pnpm lint`

Expected: PASS。

- [ ] **Step 5: Browser-verify desktop and mobile**

Start `pnpm dev`; use Playwright at 1280px and 375px to verify: enter bulk mode, select across load-more, run publish and delete confirmations, submit Obsidian export, inspect result dialog, and confirm toolbar does not overlap cards. Save screenshots under `apps/web/output/`.

- [ ] **Step 6: Fix regressions and commit**

Run focused tests after each fix. Use:

```bash
git add -A
git commit -m "fix: verify article bulk operations"
```

If nothing changed, skip this commit.
