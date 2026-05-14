# 公众号来源分类实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将归档页的 AI 智能分类改为公众号来源分类，支持多种排序方式切换

**Architecture:** 后端新增 `/sources` 接口返回公众号来源统计，修改筛选逻辑使用 `articles.source`；前端创建新组件 SourceSidebar/SourcePills 替换旧分类组件，移除 reclassify 相关代码

**Tech Stack:** Hono (API)、Drizzle ORM、Next.js、React、SWR

---

## 文件结构

**创建：**
- `apps/web/src/components/archive/SourceSidebar.tsx` - 公众号来源侧边栏（含排序切换）
- `apps/web/src/components/archive/SourcePills.tsx` - 移动端药丸式来源选择器

**修改：**
- `apps/api/src/routes/articles.ts` - 新增 /sources 接口，移除分类相关路由，修改筛选逻辑
- `apps/api/src/services/ai.service.ts` - 移除分类逻辑，保留摘要和标签生成
- `apps/web/src/lib/api.ts` - 更新 API 方法
- `apps/web/src/components/content/ArchiveContent.tsx` - 使用新组件，移除 reclassify 逻辑
- `apps/web/src/components/article/ArticleList.tsx` - 移除 reclassify props
- `apps/web/src/components/article/WechatArticleCard.tsx` - 移除重新分类按钮
- `apps/web/src/components/article/ArticleCard.tsx` - 移除分类显示
- `apps/web/src/components/article/ArticleDetailPanel.tsx` - 更新归档提示文案

**删除：**
- `apps/web/src/components/archive/WechatCategorySidebar.tsx`
- `apps/web/src/components/archive/WechatCategoryPills.tsx`
- `apps/web/src/components/archive/CategorySidebar.tsx`
- `apps/web/src/lib/categoryColors.ts`

---

### Task 1: 后端 - 新增 /sources 接口

**Files:**
- Modify: `apps/api/src/routes/articles.ts:261-268`（在 /categories 接口位置替换）

- [ ] **Step 1: 添加 /sources 接口**

在 `/categories` 接口位置替换为新接口：

```typescript
/**
 * GET /sources — 公众号来源统计（归档页使用）
 */
articlesRoutes.get('/sources', async (c) => {
  const sort = c.req.query('sort') || 'count';

  const rows = await db
    .select({
      source: articles.source,
      count: count(),
      latestCreatedAt: sql<Date>`MAX(${articles.createdAt})`,
    })
    .from(articles)
    .leftJoin(articleMetadata, eq(articles.id, articleMetadata.articleId))
    .where(eq(articleMetadata.isArchived, true))
    .where(sql`${articles.source} IS NOT NULL`)
    .groupBy(articles.source);

  // 排序
  let sorted = rows;
  if (sort === 'name') {
    sorted = rows.sort((a, b) => (a.source || '').localeCompare(b.source || '', 'zh-CN'));
  } else if (sort === 'latest') {
    sorted = rows.sort((a, b) => {
      const aTime = a.latestCreatedAt ? new Date(a.latestCreatedAt).getTime() : 0;
      const bTime = b.latestCreatedAt ? new Date(b.latestCreatedAt).getTime() : 0;
      return bTime - aTime;
    });
  } else {
    // count（默认）
    sorted = rows.sort((a, b) => b.count - a.count);
  }

  return c.json(sorted.map(r => ({
    source: r.source,
    count: r.count,
    latestCreatedAt: r.latestCreatedAt,
  })));
});
```

需要在文件顶部导入 `sql` 和 `count`（已有 `count`，需确认 `sql` 已导入）。

- [ ] **Step 2: 验证 API**

启动后端服务，访问 `http://localhost:1052/api/v1/sources` 确认返回数据格式正确。

- [ ] **Step 3: 提交**

```bash
git add apps/api/src/routes/articles.ts
git commit -m "feat(api): 新增 /sources 接口返回公众号来源统计"
```

---

### Task 2: 后端 - 修改筛选逻辑，移除分类相关路由

**Files:**
- Modify: `apps/api/src/routes/articles.ts:63-65`（筛选条件）
- Modify: `apps/api/src/routes/articles.ts:304-306`（position 接口筛选）
- Modify: `apps/api/src/routes/articles.ts:334-359`（移除 reclassify 路由）

- [ ] **Step 1: 修改筛选条件使用 source**

替换第 63-65 行：

```diff
- if (category && category !== 'all' && view === 'archive') {
-   whereCondition = and(whereCondition, eq(articleMetadata.aiCategory, category));
- }
+ if (category && category !== 'all' && view === 'archive') {
+   whereCondition = and(whereCondition, eq(articles.source, category));
+ }
```

- [ ] **Step 2: 修改 position 接口筛选条件**

替换第 304-306 行：

```diff
- if (category && category !== 'all' && view === 'archive') {
-   whereCondition = and(whereCondition, eq(articleMetadata.aiCategory, category));
- }
+ if (category && category !== 'all' && view === 'archive') {
+   whereCondition = and(whereCondition, eq(articles.source, category));
+ }
```

- [ ] **Step 3: 移除 reclassify-all 和 reclassify 路由**

删除第 334-359 行的代码（两个路由）：

```typescript
// 删除这段代码
articlesRoutes.post('/articles/reclassify-all', requireAuth, async (c) => {
  // ...
});

articlesRoutes.post('/articles/:id/reclassify', requireAuth, async (c) => {
  // ...
});
```

- [ ] **Step 4: 移除 /categories 接口**

删除第 260-268 行的 `/categories` 接口（已被 Task 1 的 `/sources` 替换）。

- [ ] **Step 5: 提交**

```bash
git add apps/api/src/routes/articles.ts
git commit -m "refactor(api): 改用 source 筛选，移除分类相关路由"
```

---

### Task 3: 后端 - 修改 AI 服务移除分类逻辑

**Files:**
- Modify: `apps/api/src/services/ai.service.ts`
- Modify: `apps/api/src/routes/articles.ts:232`（归档触发）

- [ ] **Step 1: 修改 classifyAndTag 函数**

将 `classifyAndTag` 函数重命名并简化，移除分类逻辑：

```typescript
/**
 * 归档时触发：生成摘要 + 标签（移除分类）
 */
export async function generateSummaryAndTags(articleId: number): Promise<void> {
  const [article] = await db
    .select({
      id: articles.id,
      title: articles.title,
      summary: articles.summary,
      contentHtml: articles.contentHtml,
      contentMarkdown: articles.contentMarkdown,
    })
    .from(articles)
    .where(eq(articles.id, articleId));
  if (!article) return;

  const title = article.title || '';
  const summary = article.summary || '';

  // 先抓取 markdown 正文
  const contentMd = await getArticleContent(articleId).catch((e) => {
    console.error('Fetch markdown failed:', e.message);
    return null;
  });

  const content = contentMd || article.contentMarkdown || article.contentHtml || summary;

  // 生成 AI 摘要
  await generateArticleDigest(articleId, title, content).catch((e) =>
    console.error('AI digest failed:', e.message)
  );

  // 重新查询获取刚生成的 aiSummary
  const [metaWithSummary] = await db
    .select({ aiSummary: articleMetadata.aiSummary })
    .from(articleMetadata)
    .where(eq(articleMetadata.articleId, articleId));

  // 生成标签（不传分类）
  await generateTags(articleId, title, summary, null);
}
```

- [ ] **Step 2: 修改 generateTags 函数移除 category 参数依赖**

```typescript
export async function generateTags(articleId: number, title: string, summary: string): Promise<void> {
  const system = 'You are a tag generator. Respond with ONLY a JSON array of strings, e.g. ["tag1", "tag2", "tag3"]. Nothing else.';
  const user = `Generate 3-5 concise tags for this article. Tags should be:
- In the same language as the article
- Short (1-3 words each)
- Specific and descriptive

Title: ${title}
Summary: ${summary}

Respond with ONLY a JSON array.`;

  const raw = await callAI(system, user);
  try {
    const tags = JSON.parse(raw.trim());
    if (Array.isArray(tags)) {
      await db.update(articleMetadata).set({ aiTags: tags, updatedAt: new Date() }).where(eq(articleMetadata.articleId, articleId));
    }
  } catch {
    // JSON 解析失败，忽略
  }
}
```

- [ ] **Step 3: 移除 classifyArticle 和 reclassify 相关函数**

删除以下函数：
- `classifyArticle` (第 116-141 行)
- `reclassifyArticle` (第 220-242 行)
- `reclassifyAllArticles` (第 245-264 行)

- [ ] **Step 4: 更新路由中的导入和调用**

在 `apps/api/src/routes/articles.ts` 中：

```diff
- import { classifyAndTag, reclassifyArticle, reclassifyAllArticles } from '../services/ai.service.js';
+ import { generateSummaryAndTags } from '../services/ai.service.js';
```

修改第 232 行调用：

```diff
- classifyAndTag(id).catch((e) => console.error('AI classify/tag failed:', e.message));
+ generateSummaryAndTags(id).catch((e) => console.error('AI summary/tags failed:', e.message));
```

- [ ] **Step 5: 提交**

```bash
git add apps/api/src/services/ai.service.ts apps/api/src/routes/articles.ts
git commit -m "refactor(ai): 移除分类逻辑，保留摘要和标签生成"
```

---

### Task 4: 前端 - 更新 API 客户端

**Files:**
- Modify: `apps/web/src/lib/api.ts:70-76`

- [ ] **Step 1: 更新 API 方法**

```diff
- getCategories: () => fetchJSON<any>(`/categories`),
+ getSources: (sort?: string) => fetchJSON<any>(`/sources${sort ? `?sort=${sort}` : ''}`),

- reclassify: (id: number, regenerateTags = false) =>
-   fetchJSON<any>(`/articles/${id}/reclassify`, { method: 'POST', body: JSON.stringify({ regenerateTags }) }),
-
- reclassifyAll: (regenerateTags = false) =>
-   fetchJSON<any>('/articles/reclassify-all', { method: 'POST', body: JSON.stringify({ regenerateTags }) }),
```

- [ ] **Step 2: 提交**

```bash
git add apps/web/src/lib/api.ts
git commit -m "refactor(web): 更新 API 客户端，移除分类相关方法"
```

---

### Task 5: 前端 - 创建 SourceSidebar 组件

**Files:**
- Create: `apps/web/src/components/archive/SourceSidebar.tsx`

- [ ] **Step 1: 创建 SourceSidebar 组件**

```typescript
'use client';

interface SourceCount {
  source: string;
  count: number;
  latestCreatedAt?: string;
}

interface SourceSidebarProps {
  sources: SourceCount[];
  activeSource: string;
  totalCount: number;
  onSelect: (source: string) => void;
  currentSort: string;
  onSortChange: (sort: string) => void;
}

export function SourceSidebar({
  sources,
  activeSource,
  totalCount,
  onSelect,
  currentSort,
  onSortChange,
}: SourceSidebarProps) {
  return (
    <aside
      style={{
        width: '240px',
        background: 'var(--card-bg)',
        borderRadius: '8px',
        padding: '16px',
      }}
    >
      {/* 排序选择器 */}
      <div style={{ marginBottom: '12px' }}>
        <select
          value={currentSort}
          onChange={(e) => onSortChange(e.target.value)}
          style={{
            width: '100%',
            padding: '8px 12px',
            borderRadius: '6px',
            border: '1px solid var(--border)',
            background: 'var(--card-bg)',
            color: 'var(--text)',
            fontSize: '13px',
            cursor: 'pointer',
          }}
        >
          <option value="count">按文章数量排序</option>
          <option value="name">按名称排序</option>
          <option value="latest">按最近收录</option>
        </select>
      </div>

      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {/* 全部 */}
        <li
          onClick={() => onSelect('all')}
          tabIndex={0}
          role="button"
          aria-selected={activeSource === 'all'}
          onKeyDown={(e) => e.key === 'Enter' && onSelect('all')}
          style={{
            padding: '10px 12px',
            borderRadius: '6px',
            fontSize: '14px',
            color: activeSource === 'all' ? 'var(--accent)' : 'var(--text-secondary)',
            background: activeSource === 'all' ? 'var(--accent-soft)' : 'transparent',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '4px',
            cursor: 'pointer',
          }}
        >
          <span>全部文章</span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{totalCount}</span>
        </li>

        {/* 各公众号 */}
        {sources.map((src) => {
          const isActive = activeSource === src.source;
          return (
            <li
              key={src.source}
              onClick={() => onSelect(src.source)}
              tabIndex={0}
              role="button"
              aria-selected={isActive}
              onKeyDown={(e) => e.key === 'Enter' && onSelect(src.source)}
              style={{
                padding: '10px 12px',
                borderRadius: '6px',
                fontSize: '14px',
                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                background: isActive ? 'var(--accent-soft)' : 'transparent',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '4px',
                cursor: 'pointer',
              }}
            >
              <span>{src.source}</span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{src.count}</span>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add apps/web/src/components/archive/SourceSidebar.tsx
git commit -m "feat(web): 创建 SourceSidebar 组件"
```

---

### Task 6: 前端 - 创建 SourcePills 组件

**Files:**
- Create: `apps/web/src/components/archive/SourcePills.tsx`

- [ ] **Step 1: 创建 SourcePills 组件**

```typescript
'use client';

interface SourceCount {
  source: string;
  count: number;
  latestCreatedAt?: string;
}

interface SourcePillsProps {
  sources: SourceCount[];
  activeSource: string;
  totalCount: number;
  onSelect: (source: string) => void;
}

export function SourcePills({
  sources,
  activeSource,
  totalCount,
  onSelect,
}: SourcePillsProps) {
  const allSources = [{ source: 'all', count: totalCount }, ...sources];

  return (
    <div
      style={{
        display: 'flex',
        gap: '8px',
        padding: '12px 8px',
        background: 'var(--card-bg)',
        overflowX: 'auto',
        scrollbarWidth: 'none',
      }}
      className="hide-scrollbar"
    >
      {allSources.map((src) => {
        const isActive = activeSource === src.source;
        return (
          <button
            key={src.source}
            onClick={() => onSelect(src.source)}
            type="button"
            aria-pressed={isActive}
            style={{
              padding: '6px 14px',
              borderRadius: '999px',
              fontSize: '12px',
              border: `1px solid ${isActive ? 'var(--accent)' : 'var(--border)'}`,
              color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
              background: 'transparent',
              whiteSpace: 'nowrap',
              cursor: 'pointer',
            }}
          >
            {src.source === 'all' ? '全部' : src.source}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: 提交**

```bash
git add apps/web/src/components/archive/SourcePills.tsx
git commit -m "feat(web): 创建 SourcePills 组件"
```

---

### Task 7: 前端 - 修改 ArchiveContent 使用新组件

**Files:**
- Modify: `apps/web/src/components/content/ArchiveContent.tsx`

- [ ] **Step 1: 更新导入**

```diff
- import { WechatCategorySidebar } from '@/components/archive/WechatCategorySidebar';
- import { WechatCategoryPills } from '@/components/archive/WechatCategoryPills';
+ import { SourceSidebar } from '@/components/archive/SourceSidebar';
+ import { SourcePills } from '@/components/archive/SourcePills';
```

- [ ] **Step 2: 修改状态和数据获取**

```diff
- const [activeCat, setActiveCat] = useState('all');
+ const [activeSource, setActiveSource] = useState('all');
+ const [currentSort, setCurrentSort] = useState('count');

- const { data: catData } = useSWR('categories', () => api.getCategories(), { revalidateOnFocus: false });
+ const { data: sourceData } = useSWR(`sources:${currentSort}`, () => api.getSources(currentSort), { revalidateOnFocus: false });

- const categories = catData ?? [];
- const totalCount = categories.reduce((sum: number, c: any) => sum + c.count, 0);
+ const sources = sourceData ?? [];
+ const totalCount = sources.reduce((sum: number, s: any) => sum + s.count, 0);
```

- [ ] **Step 3: 修改筛选逻辑**

```diff
- const handleCategorySelect = useCallback((cat: string) => {
-   if (cat === activeCat) return;
-   setActiveCat(cat);
+ const handleSourceSelect = useCallback((source: string) => {
+   if (source === activeSource) return;
+   setActiveSource(source);
    setPage(1);
    removingIdsRef.current.clear();
    window.scrollTo(0, 0);
- }, [activeCat]);
+ }, [activeSource]);

+ const handleSortChange = useCallback((sort: string) => {
+   setCurrentSort(sort);
+ }, []);
```

- [ ] **Step 4: 移除 reclassify 相关逻辑**

删除 `handleReclassify` 函数（第 117-127 行）和 `handleReclassifyAll` 相关代码（第 129-142 行）：

```diff
- const handleReclassify = async (id: number, e: React.MouseEvent) => {
-   e.stopPropagation();
-   try {
-     await api.reclassify(id);
-     setPage(1);
-     showToast('已重新分类');
-   } catch (error) {
-     showToast('重新分类失败，请重试');
-     console.error('Failed to reclassify:', error);
-   }
- };
-
- const [reclassifyingAll, setReclassifyingAll] = useState(false);
- const handleReclassifyAll = async () => {
-   if (reclassifyingAll) return;
-   setReclassifyingAll(true);
-   try {
-     await api.reclassifyAll();
-     showToast('已开始后台重新分类，稍后刷新查看结果');
-     setTimeout(() => { setPage(1); }, 10000);
-   } catch (error) {
-     showToast('批量重新分类失败');
-     console.error('Failed to reclassify all:', error);
-     setReclassifyingAll(false);
-   }
- };
```

- [ ] **Step 5: 更新组件使用**

```diff
    <div style={{ padding: '0' }}>
      {isMobile && (
-       <WechatCategoryPills
-         categories={categories}
-         activeCategory={activeCat}
+       <SourcePills
+         sources={sources}
+         activeSource={activeSource}
          totalCount={totalCount}
-         onSelect={handleCategorySelect}
+         onSelect={handleSourceSelect}
        />
      )}

      {!isMobile && (
        <div style={{ display: 'flex', gap: '24px' }}>
-         <WechatCategorySidebar
-           categories={categories}
-           activeCategory={activeCat}
+         <SourceSidebar
+           sources={sources}
+           activeSource={activeSource}
            totalCount={totalCount}
-           onSelect={handleCategorySelect}
-           onReclassifyAll={isAuthenticated ? handleReclassifyAll : undefined}
-           reclassifyingAll={reclassifyingAll}
+           onSelect={handleSourceSelect}
+           currentSort={currentSort}
+           onSortChange={handleSortChange}
          />
          <div style={{ flex: 1 }}>{articleListContent}</div>
        </div>
      )}
```

- [ ] **Step 6: 更新 ArticleList props**

```diff
    <ArticleList
      articles={allArticles}
      hasMore={page < totalPages}
      loadingMore={isValidating && page > 1}
      onLoadMore={handleLoadMore}
      emptyTitle="归档中暂无此类文章"
      onArticleClick={(id) => openArticle(id)}
      onToggleFavorite={handleToggleFavorite}
      onArchive={handleUnarchive}
-     onReclassify={handleReclassify}
-     showReclassify={isAuthenticated}
      showMenu={isAuthenticated}
      highlightId={highlightId}
    />
```

- [ ] **Step 7: 更新 SWR key 使用 activeSource**

```diff
  const { data, isLoading, isValidating } = useSWR(
-   `articles:archive:${page}:${activeCat}`,
+   `articles:archive:${page}:${activeSource}`,
-   () => api.getArticles('archive', page, activeCat),
+   () => api.getArticles('archive', page, activeSource),
    { revalidateOnFocus: false }
  );
```

- [ ] **Step 8: 提交**

```bash
git add apps/web/src/components/content/ArchiveContent.tsx
git commit -m "refactor(web): ArchiveContent 改用公众号来源筛选"
```

---

### Task 8: 前端 - 修改 ArticleList 移除 reclassify props

**Files:**
- Modify: `apps/web/src/components/article/ArticleList.tsx`

- [ ] **Step 1: 移除 props 定义**

```diff
interface ArticleListProps {
  articles: ArticleListItem[];
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  emptyTitle?: string;
  onArticleClick: (id: number) => void;
  onToggleFavorite: (id: number, e: React.MouseEvent) => void;
  onArchive: (id: number, e: React.MouseEvent) => void;
- onReclassify?: (id: number, e: React.MouseEvent) => void;
- showReclassify?: boolean;
  showMenu?: boolean;
  highlightId?: number | null;
}
```

- [ ] **Step 2: 移除组件参数**

```diff
export function ArticleList({
  articles,
  hasMore,
  loadingMore,
  onLoadMore,
  emptyTitle = '暂无文章',
  onArticleClick,
  onToggleFavorite,
  onArchive,
- onReclassify,
- showReclassify,
  showMenu = true,
  highlightId,
}: ArticleListProps) {
```

- [ ] **Step 3: 移除传给 WechatArticleCard 的 props**

```diff
        {articles.map((article) => (
          <WechatArticleCard
            key={article.id}
            article={article}
            onClick={() => onArticleClick(article.id)}
            onToggleFavorite={(e) => onToggleFavorite(article.id, e)}
            onArchive={(e) => onArchive(article.id, e)}
-           onReclassify={onReclassify ? (e) => onReclassify(article.id, e) : undefined}
-           showReclassify={showReclassify}
            showMenu={showMenu}
            highlight={highlightId === article.id}
          />
        ))}
```

- [ ] **Step 4: 提交**

```bash
git add apps/web/src/components/article/ArticleList.tsx
git commit -m "refactor(web): ArticleList 移除 reclassify props"
```

---

### Task 9: 前端 - 修改 WechatArticleCard 移除重新分类按钮

**Files:**
- Modify: `apps/web/src/components/article/WechatArticleCard.tsx`

- [ ] **Step 1: 移除 props 定义**

```diff
interface WechatArticleCardProps {
  article: ArticleListItem;
  onClick: () => void;
  onToggleFavorite: (e: React.MouseEvent) => void;
  onArchive: (e: React.MouseEvent) => void;
- onReclassify?: (e: React.MouseEvent) => void;
- showReclassify?: boolean;
  showMenu?: boolean;
  highlight?: boolean;
}

- export function WechatArticleCard({ article, onClick, onToggleFavorite, onArchive, onReclassify, showReclassify, showMenu = true, highlight }: WechatArticleCardProps) {
+ export function WechatArticleCard({ article, onClick, onToggleFavorite, onArchive, showMenu = true, highlight }: WechatArticleCardProps) {
```

- [ ] **Step 2: 移除 SyncOutlined 导入**

```diff
- import { MoreOutlined, HeartOutlined, HeartFilled, FolderOutlined, FolderFilled, SyncOutlined } from '@ant-design/icons';
+ import { MoreOutlined, HeartOutlined, HeartFilled, FolderOutlined, FolderFilled } from '@ant-design/icons';
```

- [ ] **Step 3: 移除重新分类按钮代码**

删除菜单中的重新分类按钮（第 144-163 行）：

```diff
                    <button
                      onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onArchive(e); }}
                      // ... 归档按钮代码
                    >
                      {article.isArchived ? (
                        <>
                          <FolderFilled style={{ fontSize: '16px', color: 'var(--accent)' }} />
                          <FolderOutlined style={{ fontSize: '16px' }} />
                        </>
                      ) : (
                        // ...
                      )}
                      {article.isArchived ? '取消归档' : '归档'}
                    </button>
-                   {showReclassify && onReclassify && (
-                     <button
-                       onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onReclassify(e); }}
-                       style={{
-                         display: 'flex',
-                         alignItems: 'center',
-                         gap: '8px',
-                         padding: '12px 16px',
-                         width: '100%',
-                         background: 'transparent',
-                         border: 'none',
-                         cursor: 'pointer',
-                         fontSize: '14px',
-                         color: 'var(--text)',
-                       }}
-                     >
-                       <SyncOutlined style={{ fontSize: '16px' }} />
-                       重新分类
-                     </button>
-                   )}
                  </div>
```

- [ ] **Step 4: 提交**

```bash
git add apps/web/src/components/article/WechatArticleCard.tsx
git commit -m "refactor(web): WechatArticleCard 移除重新分类按钮"
```

---

### Task 10: 前端 - 修改 ArticleCard 移除分类显示

**Files:**
- Modify: `apps/web/src/components/article/ArticleCard.tsx`

- [ ] **Step 1: 移除分类显示和导入**

```diff
- import { getCategoryColor } from '@/lib/categoryColors';
```

删除分类显示代码（第 41-56 行）：

```diff
      <div className="article-card-meta">
-       {/* 归档文章显示分类 */}
-       {article.isArchived && article.aiCategory && (
-         <span
-           style={{
-             fontSize: 10,
-             fontWeight: 500,
-             color: getCategoryColor(article.aiCategory).text,
-             background: getCategoryColor(article.aiCategory).bg,
-             padding: '2px 6px',
-             borderRadius: 4,
-             marginRight: 6,
-           }}
-         >
-           {article.aiCategory}
-         </span>
-       )}
        <span className="article-card-source">{article.source}</span>
```

- [ ] **Step 2: 提交**

```bash
git add apps/web/src/components/article/ArticleCard.tsx
git commit -m "refactor(web): ArticleCard 移除分类显示"
```

---

### Task 11: 前端 - 修改 ArticleDetailPanel 更新文案

**Files:**
- Modify: `apps/web/src/components/article/ArticleDetailPanel.tsx:140`

- [ ] **Step 1: 更新归档提示文案**

```diff
                      showToast('已归档 — AI 正在自动分类…');
+                     showToast('已归档 — AI 正在生成摘要…');
```

- [ ] **Step 2: 提交**

```bash
git add apps/web/src/components/article/ArticleDetailPanel.tsx
git commit -m "refactor(web): 更新归档提示文案"
```

---

### Task 12: 清理 - 删除旧组件和文件

**Files:**
- Delete: `apps/web/src/components/archive/WechatCategorySidebar.tsx`
- Delete: `apps/web/src/components/archive/WechatCategoryPills.tsx`
- Delete: `apps/web/src/components/archive/CategorySidebar.tsx`
- Delete: `apps/web/src/lib/categoryColors.ts`

- [ ] **Step 1: 删除文件**

```bash
rm apps/web/src/components/archive/WechatCategorySidebar.tsx
rm apps/web/src/components/archive/WechatCategoryPills.tsx
rm apps/web/src/components/archive/CategorySidebar.tsx
rm apps/web/src/lib/categoryColors.ts
```

- [ ] **Step 2: 提交**

```bash
git add -A
git commit -m "chore: 删除旧的分类组件和 categoryColors"
```

---

### Task 13: 验证功能

- [ ] **Step 1: 启动开发环境**

```bash
pnpm dev
```

- [ ] **Step 2: 测试归档页**

1. 访问 http://localhost:1050/archive
2. 确认左侧显示公众号来源列表
3. 测试排序切换（数量/名称/最近收录）
4. 点击不同公众号，确认文章列表正确筛选
5. 测试移动端药丸显示（窗口宽度 < 768px）

- [ ] **Step 3: 测试归档流程**

1. 在收件箱归档一篇新文章
2. 确认归档后 AI 摘要正常生成
3. 确认不再有分类生成

- [ ] **Step 4: 最终提交**

```bash
git add -A
git commit -m "feat: 归档页改用公众号来源分类"
```