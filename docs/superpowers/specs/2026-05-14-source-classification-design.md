# 公众号来源分类设计文档

## 背景

当前归档页使用 AI 智能分类（`aiCategory`），用户反馈用处不大。改为按公众号来源（`articles.source`）分类，方便快速定位某个公众号的所有文章。

## 目标

1. 移除 AI 分类功能，保留 AI 摘要和标签
2. 归档页改为按公众号来源分类
3. 支持多种排序方式切换（文章数量/名称/最近收录）
4. 移除手动分类相关按钮和功能

## 改动范围

### API 层

#### 新增接口

**GET /sources**

返回公众号来源统计：

```ts
[
  { source: "雷锋网", count: 42, latestCreatedAt: "2026-05-12T..." },
  { source: "36氪", count: 28, latestCreatedAt: "2026-05-10T..." }
]
```

参数：
- `sort`: 排序方式，可选值 `count`（默认）、`name`、`latest`

#### 移除接口

- `/categories`
- `/articles/:id/reclassify`
- `/articles/reclassify-all`

#### 修改接口

**GET /articles**

归档视图的 category 参数改为按 source 筛选：

```diff
- if (category && category !== 'all' && view === 'archive') {
-   whereCondition = and(whereCondition, eq(articleMetadata.aiCategory, category));
- }
+ if (category && category !== 'all' && view === 'archive') {
+   whereCondition = and(whereCondition, eq(articles.source, category));
+ }
```

**POST /articles/:id/archive**

归档时只触发 AI 摘要和标签生成，不再生成分类。

### 前端组件

#### 新建组件

**SourceSidebar.tsx**

公众号来源侧边栏，包含：
- 来源列表（全部 + 各公众号）
- 文章数量显示
- 排序切换下拉菜单

**SourcePills.tsx**

移动端药丸式来源选择器。

#### 移除组件

- `WechatCategorySidebar.tsx`
- `WechatCategoryPills.tsx`
- `CategorySidebar.tsx`
- `CategoryPills.tsx`

#### 修改组件

**ArchiveContent.tsx**

- 使用 SourceSidebar 和 SourcePills
- 移除 handleReclassify 和 handleReclassifyAll 逻辑
- 状态从 activeCategory 改为 activeSource

**ArticleCard.tsx / WechatArticleCard.tsx**

- 移除"重新分类"按钮

**ArticleList.tsx**

- 移除 `onReclassify` 和 `showReclassify` props

**ArticleDetailPanel.tsx**

- 移除分类显示和重新分类按钮（如有）

### 其他文件

**api.ts**

```diff
- getCategories: () => fetchJSON<any>(`/categories`),
- reclassify: (id: number, regenerateTags = false) => ...
- reclassifyAll: (regenerateTags = false) => ...
+ getSources: (sort?: string) => fetchJSON<any>(`/sources${sort ? `?sort=${sort}` : ''}`),
```

**ai.service.ts**

移除分类逻辑，保留摘要和标签生成：
- 移除 `classifyAndTag` 函数
- 修改为 `generateSummaryAndTags` 函数
- 移除 `reclassifyArticle` 和 `reclassifyAllArticles` 函数

**categoryColors.ts**

可删除，不再需要分类颜色映射。

## 排序功能

侧边栏顶部提供排序切换下拉菜单：

- 按文章数量（默认）
- 按名称排序
- 按最近收录

排序状态由前端管理，切换时重新请求 `/sources?sort=xxx`。

## 数据库

无需改动 schema。`aiCategory` 字段保留但不更新，历史数据保持不变。

## 实现顺序

1. 后端：新增 `/sources` 接口，修改筛选逻辑
2. 后端：移除分类相关接口和 AI 分类逻辑
3. 前端：创建新组件 SourceSidebar、SourcePills
4. 前端：修改 ArchiveContent 使用新组件
5. 前端：移除旧组件和分类相关代码
6. 前端：移除 ArticleCard 中的重新分类按钮
7. 清理：删除无用文件和函数