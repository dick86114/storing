# 文章列表图文展示设计

## 背景

项目当前的文章列表只显示文字信息（标题、摘要、标签等），缺少封面图展示。用户希望在收件箱、收藏夹、归档三个页面的列表中都增加图文展示功能。

## 需求摘要

- **范围**：所有列表页面（收件箱、收藏夹、归档）
- **布局策略**：
  - 瀑布流网格（收件箱）：图片在卡片顶部
  - 垂直列表（收藏夹、归档）：图片在卡片左侧
- **无图处理**：没有封面图的文章保持纯文字样式
- **图片尺寸**：固定高度（响应式适配）
- **切换功能**：不需要，图文为默认模式

## 数据层修改

### ArticleListItem 接口

在 `packages/shared/src/types.ts` 中添加 `coverImage` 字段：

```typescript
export interface ArticleListItem {
  id: number;
  title: string;
  source: string;
  publishTime: string | null;
  createdAt: string;
  summary: string;
  aiTags: string[];
  isFavorited: boolean;
  isArchived?: boolean;
  coverImage?: string | null;  // 新增：封面图 URL
}
```

API 已返回 `coverImage` 字段，只需补充前端类型定义。

## 组件层修改

### ArticleCard 组件

添加 `variant` prop 区分两种布局：

```typescript
interface ArticleCardProps {
  article: ArticleListItem;
  variant?: 'masonry' | 'list';
  onArchive?: () => void;
  onFavorite?: () => void;
}
```

**瀑布流布局 (masonry)**：

```
+------------------+
|     封面图       |  height: 200px (响应式)
+------------------+
| 来源 · 日期  [•] |
| 标题             |
| 摘要 (2行)       |
| 标签 标签 标签   |
+------------------+
```

**列表布局 (list)**：

```
+--------+-------------------+
| 封面图 | 来源 · 日期  [•]  |
| 80x80  | 标题              |
|        | 摘要 (2行)        |
|        | 标签 标签 标签    |
+--------+-------------------+
```

无封面图时，不渲染图片元素，保持原有纯文字布局。

## CSS 样式

### 瀑布流卡片图片

```css
.article-card--masonry .article-card__image {
  width: 100%;
  height: 200px;
  object-fit: cover;
  border-radius: var(--radius-md) var(--radius-md) 0 0;
  margin-bottom: var(--gap-md);
}

@media (max-width: 960px) {
  .article-card--masonry .article-card__image { height: 180px; }
}

@media (max-width: 640px) {
  .article-card--masonry .article-card__image { height: 160px; }
}
```

### 列表卡片布局

```css
.article-card--list {
  display: flex;
  gap: var(--gap-md);
}

.article-card--list .article-card__thumbnail {
  width: 80px;
  height: 80px;
  object-fit: cover;
  border-radius: var(--radius-md);
  flex-shrink: 0;
}

.article-card--list .article-card__content {
  flex: 1;
  min-width: 0;
}

@media (max-width: 640px) {
  .article-card--list .article-card__thumbnail {
    width: 64px;
    height: 64px;
  }
}
```

## 页面调用

| 页面 | variant |
|-----|---------|
| InboxContent | `masonry` |
| FavoritesContent | `list` |
| ArchiveContent | `list` |

## 修改文件清单

| 文件 | 修改内容 |
|-----|---------|
| `packages/shared/src/types.ts` | 添加 `coverImage` 字段 |
| `apps/web/src/components/content/ArticleCard.tsx` | 添加 `variant` prop，实现两种布局 |
| `apps/web/src/app/globals.css` | 添加图片相关 CSS |
| `apps/web/src/components/content/InboxContent.tsx` | 传递 `variant="masonry"` |
| `apps/web/src/components/content/FavoritesContent.tsx` | 传递 `variant="list"` |
| `apps/web/src/components/content/ArchiveContent.tsx` | 传递 `variant="list"` |