# 移动端详情页优化 + 书签功能实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复移动端详情页空白问题，添加书签功能让用户可以保存阅读位置

**Architecture:** CSS 修复移动端布局；新增 useBookmark hook 管理 localStorage 书签；修改详情面板添加书签按钮；各视图页面添加书签检测和提示

**Tech Stack:** React、localStorage、Next.js App Router

---

## 文件结构

**创建：**
- `apps/web/src/hooks/useBookmark.ts` - 书签状态管理 hook

**修改：**
- `apps/web/src/app/globals.css` - 移动端布局修复
- `apps/web/src/components/article/ArticleDetailPanel.tsx` - 添加书签按钮和滚动位置记录
- `apps/web/src/components/providers/ArticleContext.tsx` - 添加恢复滚动位置的方法
- `apps/web/src/components/content/ArchiveContent.tsx` - 添加书签检测和提示
- `apps/web/src/components/content/InboxContent.tsx` - 添加书签检测和提示
- `apps/web/src/components/content/FavoritesContent.tsx` - 添加书签检测和提示

---

### Task 1: 修复移动端详情页空白问题

**Files:**
- Modify: `apps/web/src/app/globals.css:547-560`（detail-panel-overlay 和 detail-panel 样式区域）

- [ ] **Step 1: 添加 overflow-x: hidden 到 overlay**

在 `.detail-panel-overlay` 样式中添加：

```css
.detail-panel-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 200;
  background: color-mix(in oklch, var(--bg) 60%, transparent);
  opacity: 1;
  pointer-events: auto;
  transition: opacity 0.3s ease;
  overflow-x: hidden;  /* 新增：阻止水平滚动 */
}
```

- [ ] **Step 2: 添加移动端响应式样式**

在 globals.css 中添加移动端样式（约第 560 行之后）：

```css
/* 移动端详情面板全宽 */
@media (max-width: 640px) {
  .detail-panel {
    width: 100vw;
    max-width: 100vw;
  }
  
  .detail-panel-content {
    width: 100%;
    box-sizing: border-box;
  }
}
```

- [ ] **Step 3: 提交**

```bash
git add apps/web/src/app/globals.css
git commit -m "fix: 修复移动端详情页空白和水平滚动问题"
```

---

### Task 2: 创建 useBookmark hook

**Files:**
- Create: `apps/web/src/hooks/useBookmark.ts`

- [ ] **Step 1: 创建 hook 文件**

```typescript
'use client';

const BOOKMARK_KEY = 'reading_bookmark';

export interface ReadingBookmark {
  view: 'inbox' | 'archive' | 'favorites';
  articleId: number;
  scrollPosition: number;
  articleTitle?: string;
  timestamp: number;
}

export function useBookmark() {
  // 保存书签
  const saveBookmark = (bookmark: ReadingBookmark) => {
    localStorage.setItem(BOOKMARK_KEY, JSON.stringify(bookmark));
  };

  // 获取书签
  const getBookmark = (): ReadingBookmark | null => {
    const data = localStorage.getItem(BOOKMARK_KEY);
    if (!data) return null;
    try {
      return JSON.parse(data) as ReadingBookmark;
    } catch {
      return null;
    }
  };

  // 清除书签
  const clearBookmark = () => {
    localStorage.removeItem(BOOKMARK_KEY);
  };

  return { saveBookmark, getBookmark, clearBookmark };
}
```

- [ ] **Step 2: 提交**

```bash
git add apps/web/src/hooks/useBookmark.ts
git commit -m "feat: 创建 useBookmark hook 管理阅读书签"
```

---

### Task 3: 添加书签按钮到详情面板

**Files:**
- Modify: `apps/web/src/components/article/ArticleDetailPanel.tsx`

- [ ] **Step 1: 导入 useBookmark hook**

在文件顶部添加导入：

```typescript
import { useBookmark, type ReadingBookmark } from '@/hooks/useBookmark';
```

- [ ] **Step 2: 添加滚动位置追踪状态**

在组件内添加：

```typescript
const [scrollPosition, setScrollPosition] = useState(0);
const contentRef = useRef<HTMLDivElement>(null);
const { saveBookmark } = useBookmark();

// 监听滚动位置
useEffect(() => {
  const content = contentRef.current;
  if (!content) return;
  
  const handleScroll = () => {
    setScrollPosition(content.scrollTop);
  };
  
  content.addEventListener('scroll', handleScroll);
  return () => content.removeEventListener('scroll', handleScroll);
}, [articleId]);
```

- [ ] **Step 3: 添加保存书签函数**

```typescript
const handleSaveBookmark = () => {
  if (!article) return;
  
  // 获取当前视图（从 URL 或 context）
  const path = window.location.pathname;
  const view = path.includes('inbox') ? 'inbox' 
    : path.includes('favorites') ? 'favorites' 
    : 'archive';
  
  saveBookmark({
    view,
    articleId: article.id,
    scrollPosition,
    articleTitle: article.title,
    timestamp: Date.now(),
  });
  
  showToast('已保存书签');
};
```

- [ ] **Step 4: 添加书签按钮到操作区**

在 header 的操作按钮区域最左边添加书签按钮（在其他按钮之前）：

```typescript
{article && (
  <div className="flex" style={{ gap: 'var(--gap-xs)' }}>
    {/* 书签按钮 - 最左边 */}
    <button
      onClick={handleSaveBookmark}
      className="detail-panel-action-btn"
      title="保存书签"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ width: 18, height: 18 }}>
        <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
      </svg>
    </button>
    
    {/* 其他按钮：分享、收藏、归档等 */}
    ...
  </div>
)}
```

- [ ] **Step 5: 给内容区域添加 ref**

修改 detail-panel-content 的 div，添加 ref：

```typescript
<div className="detail-panel-content" ref={contentRef}>
```

- [ ] **Step 6: 提交**

```bash
git add apps/web/src/components/article/ArticleDetailPanel.tsx
git commit -m "feat: 添加书签按钮到详情面板操作区"
```

---

### Task 4: 扩展 ArticleContext 支持恢复滚动位置

**Files:**
- Modify: `apps/web/src/components/providers/ArticleContext.tsx`

- [ ] **Step 1: 扩展 context 接口**

添加 `scrollToPosition` 方法：

```typescript
interface ArticleContextValue {
  selectedId: number | null;
  highlightId: number | null;
  openArticle: (id: number) => void;
  closeArticle: () => void;
  highlightAndOpen: (id: number, view: 'inbox' | 'favorites' | 'archive') => void;
  clearHighlight: () => void;
  mutateList: () => void;
  setMutateFn: (fn: () => void) => void;
  scrollToPosition: (position: number) => void;  // 新增
  setScrollPosition: (position: number) => void;  // 新增：设置待恢复的位置
}
```

- [ ] **Step 2: 添加状态和方法**

```typescript
const [pendingScrollPosition, setPendingScrollPosition] = useState<number | null>(null);

const scrollToPosition = useCallback((position: number) => {
  // 延迟执行，等详情面板渲染完成
  setTimeout(() => {
    const content = document.querySelector('.detail-panel-content');
    if (content) {
      content.scrollTop = position;
    }
  }, 100);
}, []);

const setScrollPosition = useCallback((position: number) => {
  setPendingScrollPosition(position);
}, []);
```

- [ ] **Step 3: 在 selectedId 变化时自动滚动**

修改 useEffect 或在 openArticle 后处理：

```typescript
// 当文章打开且有待恢复的滚动位置时，自动滚动
useEffect(() => {
  if (selectedId && pendingScrollPosition) {
    scrollToPosition(pendingScrollPosition);
    setPendingScrollPosition(null);
  }
}, [selectedId, pendingScrollPosition, scrollToPosition]);
```

- [ ] **Step 4: 更新 Provider value**

```typescript
<ArticleContext.Provider value={{ 
  selectedId, 
  highlightId, 
  openArticle, 
  closeArticle, 
  highlightAndOpen, 
  clearHighlight,
  mutateList, 
  setMutateFn,
  scrollToPosition,
  setScrollPosition,
}}>
```

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/components/providers/ArticleContext.tsx
git commit -m "feat: ArticleContext 支持恢复滚动位置"
```

---

### Task 5: ArchiveContent 添加书签检测和提示

**Files:**
- Modify: `apps/web/src/components/content/ArchiveContent.tsx`

- [ ] **Step 1: 导入 useBookmark**

```typescript
import { useBookmark } from '@/hooks/useBookmark';
```

- [ ] **Step 2: 添加书签检测状态和逻辑**

```typescript
const { getBookmark, clearBookmark } = useBookmark();
const [bookmarkPrompt, setBookmarkPrompt] = useState<ReadingBookmark | null>(null);
const { openArticle, setScrollPosition } = useArticleContext();

// 页面加载时检测书签
useEffect(() => {
  const bookmark = getBookmark();
  if (bookmark) {
    setBookmarkPrompt(bookmark);
  }
}, [getBookmark]);
```

- [ ] **Step 3: 添加处理书签的函数**

```typescript
const handleContinueReading = () => {
  if (!bookmarkPrompt) return;
  
  // 设置滚动位置
  setScrollPosition(bookmarkPrompt.scrollPosition);
  
  // 如果书签是 archive 视图，直接打开
  if (bookmarkPrompt.view === 'archive') {
    openArticle(bookmarkPrompt.articleId);
  }
  // 否则需要导航到对应视图（这里简化处理，只提示）
  
  setBookmarkPrompt(null);
};

const handleDismissBookmark = () => {
  clearBookmark();
  setBookmarkPrompt(null);
};
```

- [ ] **Step 4: 添加提示 UI**

在组件 return 的最前面添加提示弹窗：

```typescript
{/* 书签提示 */}
{bookmarkPrompt && (
  <div
    style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      background: 'rgba(0,0,0,0.5)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 300,
    }}
  >
    <div
      style={{
        background: 'var(--card-bg)',
        padding: '24px',
        borderRadius: '12px',
        maxWidth: '320px',
        textAlign: 'center',
      }}
    >
      <p style={{ marginBottom: '16px', color: 'var(--text)' }}>
        检测到上次的书签「{bookmarkPrompt.articleTitle || '未命名文章'}」，是否继续阅读？
      </p>
      <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
        <button
          onClick={handleContinueReading}
          style={{
            padding: '10px 20px',
            background: 'var(--accent)',
            color: '#fff',
            borderRadius: '6px',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          继续阅读
        </button>
        <button
          onClick={handleDismissBookmark}
          style={{
            padding: '10px 20px',
            background: 'transparent',
            color: 'var(--text-muted)',
            borderRadius: '6px',
            border: '1px solid var(--border)',
            cursor: 'pointer',
          }}
        >
          取消
        </button>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 5: 提交**

```bash
git add apps/web/src/components/content/ArchiveContent.tsx
git commit -m "feat: ArchiveContent 添加书签检测和继续阅读提示"
```

---

### Task 6: InboxContent 添加书签检测

**Files:**
- Modify: `apps/web/src/components/content/InboxContent.tsx`

- [ ] **Step 1: 参考 Task 5 添加相同逻辑**

需要额外处理：如果书签是 inbox 视图，直接打开；否则不做处理（让对应视图页面处理）

- [ ] **Step 2: 提交**

```bash
git add apps/web/src/components/content/InboxContent.tsx
git commit -m "feat: InboxContent 添加书签检测"
```

---

### Task 7: FavoritesContent 添加书签检测

**Files:**
- Modify: `apps/web/src/components/content/FavoritesContent.tsx`

- [ ] **Step 1: 参考 Task 5 添加相同逻辑**

- [ ] **Step 2: 提交**

```bash
git add apps/web/src/components/content/FavoritesContent.tsx
git commit -m "feat: FavoritesContent 添加书签检测"
```

---

### Task 8: 验证功能

- [ ] **Step 1: 启动开发环境**

```bash
pnpm dev
```

- [ ] **Step 2: 测试移动端布局**

1. 在浏览器模拟移动端（宽度 < 640px）
2. 打开归档页，点击文章查看详情
3. 确认详情页全宽，无水平滚动

- [ ] **Step 3: 测试书签功能**

1. 打开文章详情，滚动到某个位置
2. 点击书签按钮，确认 Toast 显示"已保存书签"
3. 刷新页面，确认弹窗提示书签信息
4. 点击"继续阅读"，确认打开正确的文章并滚动到保存的位置
5. 点击"取消"，确认书签被清除

- [ ] **Step 4: 最终提交**

```bash
git add -A
git commit -m "feat: 移动端详情页优化和书签功能"
```