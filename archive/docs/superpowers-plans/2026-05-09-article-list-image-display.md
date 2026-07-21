# 文章列表图文展示实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为文章列表增加封面图展示功能，瀑布流布局图片在顶部，列表布局图片在左侧。

**Architecture:** 通过 ArticleCard 组件的 `variant` prop 区分两种布局，根据 `coverImage` 是否存在决定是否渲染图片。

**Tech Stack:** React, TypeScript, CSS (globals.css)

---

## Task 1: 修改 ArticleListItem 类型定义

**Files:**
- Modify: `packages/shared/src/types.ts:25-35`

- [ ] **Step 1: 在 ArticleListItem 接口添加 coverImage 字段**

```typescript
// 列表项简化版本（API 列表接口返回）
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

- [ ] **Step 2: 提交类型修改**

```bash
git add packages/shared/src/types.ts
git commit -m "feat: ArticleListItem 添加 coverImage 字段"
```

---

## Task 2: 修改 ArticleCard 组件支持图片展示

**Files:**
- Modify: `apps/web/src/components/article/ArticleCard.tsx`

- [ ] **Step 1: 添加 variant prop 和图片渲染逻辑**

完整替换 ArticleCard.tsx 文件：

```typescript
'use client';

import { useState, useRef, useEffect } from 'react';
import { DateText } from '@/lib/formatDate';
import type { ArticleListItem } from '@storing/shared';

export function ArticleCard({
  article,
  onClick,
  onToggleFavorite,
  onArchive,
  isHighlighted = false,
  variant = 'list',
}: {
  article: ArticleListItem;
  onClick: () => void;
  onToggleFavorite: (e: React.MouseEvent) => void;
  onArchive: (e: React.MouseEvent) => void;
  isHighlighted?: boolean;
  variant?: 'masonry' | 'list';
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const hasImage = article.coverImage && article.coverImage.trim() !== '';

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [menuOpen]);

  const cardContent = (
    <>
      <div className="article-card-meta">
        <span className="article-card-source">{article.source}</span>
        <span className="article-card-dot" />
        <DateText dateStr={article.publishTime} className="article-card-date" />
        <div style={{ flex: 1 }} />
        <div ref={menuRef} style={{ position: 'relative' }}>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
            className="article-card-menu-btn"
            aria-label="更多操作"
            title="更多操作"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" style={{ width: 16, height: 16 }}>
              <circle cx="12" cy="5" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="12" cy="19" r="1.5" />
            </svg>
          </button>
          {menuOpen && (
            <div className="article-card-menu" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={(e) => {
                  onToggleFavorite(e);
                  setMenuOpen(false);
                }}
                className={`article-card-menu-item ${article.isFavorited ? 'favorited' : ''}`}
              >
                <svg viewBox="0 0 24 24" fill={article.isFavorited ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14, flexShrink: 0 }}>
                  <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
                </svg>
                {article.isFavorited ? '取消收藏' : '收藏'}
              </button>
              <button
                onClick={(e) => {
                  onArchive(e);
                  setMenuOpen(false);
                }}
                className="article-card-menu-item"
              >
                {article.isArchived ? (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14, flexShrink: 0 }}>
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="17 8 12 3 7 8" />
                      <line x1="12" x2="12" y1="3" y2="15" />
                    </svg>
                    移回收件箱
                  </>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14, flexShrink: 0 }}>
                      <rect width="20" height="5" x="2" y="3" rx="1" />
                      <path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8" />
                      <path d="M10 12h4" />
                    </svg>
                    归档
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
      <h3 className="article-card-title">
        {article.title?.replace(/[\r\n]+/g, ' ')}
      </h3>
      <p className="article-card-summary">
        {article.summary}
      </p>
      <div className="article-card-tags">
        {article.aiTags.slice(0, 3).map((tag) => (
          <span key={tag} className="article-card-tag">
            {tag}
          </span>
        ))}
      </div>
    </>
  );

  // 瀑布流布局：图片在顶部
  if (variant === 'masonry' && hasImage) {
    return (
      <article
        onClick={onClick}
        className={`article-card article-card--masonry ${isHighlighted ? 'highlighted' : ''}`}
      >
        <img
          src={article.coverImage!}
          alt={article.title || '文章封面'}
          className="article-card__image"
        />
        {cardContent}
      </article>
    );
  }

  // 列表布局：图片在左侧
  if (variant === 'list' && hasImage) {
    return (
      <article
        onClick={onClick}
        className={`article-card article-card--list ${isHighlighted ? 'highlighted' : ''}`}
      >
        <img
          src={article.coverImage!}
          alt={article.title || '文章封面'}
          className="article-card__thumbnail"
        />
        <div className="article-card__content">
          {cardContent}
        </div>
      </article>
    );
  }

  // 无封面图或默认：纯文字布局
  return (
    <article
      onClick={onClick}
      className={`article-card ${isHighlighted ? 'highlighted' : ''}`}
    >
      {cardContent}
    </article>
  );
}
```

- [ ] **Step 2: 提交组件修改**

```bash
git add apps/web/src/components/article/ArticleCard.tsx
git commit -m "feat: ArticleCard 添加 variant prop 和封面图展示"
```

---

## Task 3: 添加图片相关 CSS 样式

**Files:**
- Modify: `apps/web/src/app/globals.css`

- [ ] **Step 1: 在 article-card-tag 样式后添加图片样式**

在 `apps/web/src/app/globals.css` 第 467 行（`.article-card-tag` 样式块后）添加以下 CSS：

```css
/* 瀑布流卡片图片 */
.article-card--masonry {
  padding-top: 0;
}

.article-card--masonry .article-card__image {
  width: 100%;
  height: 200px;
  object-fit: cover;
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  margin-bottom: var(--gap-md);
}

@media (max-width: 960px) {
  .article-card--masonry .article-card__image {
    height: 180px;
  }
}

@media (max-width: 640px) {
  .article-card--masonry .article-card__image {
    height: 160px;
  }
}

/* 列表卡片布局 */
.article-card--list {
  display: flex;
  gap: var(--gap-md);
  padding: var(--gap-md);
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

- [ ] **Step 2: 提交样式修改**

```bash
git add apps/web/src/app/globals.css
git commit -m "feat: 添加文章卡片图片展示样式"
```

---

## Task 4: 修改 MasonryGrid 传递 variant prop

**Files:**
- Modify: `apps/web/src/components/article/MasonryGrid.tsx`

- [ ] **Step 1: 在 ArticleCard 调用中添加 variant="masonry"**

修改第 50-57 行的 ArticleCard 调用：

```typescript
<ArticleCard
  key={a.id}
  article={a}
  variant="masonry"
  onClick={() => onArticleClick(a.id)}
  onToggleFavorite={(e) => onToggleFavorite(a.id, e)}
  onArchive={(e) => onArchive(a.id, e)}
  isHighlighted={highlightId === a.id}
/>
```

- [ ] **Step 2: 提交修改**

```bash
git add apps/web/src/components/article/MasonryGrid.tsx
git commit -m "feat: MasonryGrid 传递 variant=\"masonry\" 给 ArticleCard"
```

---

## Task 5: 修改 ArticleList 传递 variant prop

**Files:**
- Modify: `apps/web/src/components/article/ArticleList.tsx`

- [ ] **Step 1: 在 ArticleCard 调用中添加 variant="list"**

修改第 38-45 行的 ArticleCard 调用：

```typescript
<ArticleCard
  key={a.id}
  article={a}
  variant="list"
  onClick={() => onArticleClick(a.id)}
  onToggleFavorite={(e) => onToggleFavorite(a.id, e)}
  onArchive={(e) => onArchive(a.id, e)}
  isHighlighted={highlightId === a.id}
/>
```

- [ ] **Step 2: 提交修改**

```bash
git add apps/web/src/components/article/ArticleList.tsx
git commit -m "feat: ArticleList 传递 variant=\"list\" 给 ArticleCard"
```

---

## Task 6: 验证功能

- [ ] **Step 1: 启动开发服务器**

```bash
cd /Users/dickies/Documents/workspaces/storing && pnpm dev
```

等待服务启动完成。

- [ ] **Step 2: 在浏览器中验证**

访问 http://localhost:1050：
1. 检查收件箱页面：有封面图的文章显示图片在卡片顶部
2. 检查收藏夹页面：有封面图的文章显示图片在卡片左侧
3. 检查归档页面：有封面图的文章显示图片在卡片左侧
4. 检查无封面图的文章：保持原有纯文字样式
5. 检查响应式：调整浏览器宽度，验证图片尺寸变化

- [ ] **Step 3: 确认无报错**

检查浏览器控制台无报错，检查终端无报错。

---

## Task 7: 最终提交

- [ ] **Step 1: 确保所有更改已提交**

```bash
git status
git log --oneline -5
```

- [ ] **Step 2: 合并为一个功能提交（可选）**

如果之前的提交都是同一个功能，可以合并：

```bash
git rebase -i HEAD~6
# 将所有 "feat: ..." 提交 squash 为一个
```

或保持分开的提交记录也可以。