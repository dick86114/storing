# 微信风格 UI 重构实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 全站UI重构为微信风格，包括移动端滑动Tab、底部导航、文章卡片、详情页、桌面端布局、归档页分类筛选等

**Architecture:** 采用CSS scroll-snap替代scroll事件监听实现稳定滑动Tab；使用CSS Grid auto-fill实现响应式卡片布局；桌面端详情页采用右侧滑出面板设计；所有图标统一使用Ant Design线条风格

**Tech Stack:** Next.js 15, React, CSS Variables, Ant Design Icons (@ant-design/icons)

---

## 文件结构规划

### 新建文件
- `apps/web/src/components/layout/SwipeableContainer.tsx` - scroll-snap滑动容器
- `apps/web/src/components/layout/MobileTopNav.tsx` - 移动端顶部导航
- `apps/web/src/components/layout/MobileBottomTab.tsx` - 移动端底部Tab栏
- `apps/web/src/components/article/WechatArticleCard.tsx` - 微信风格文章卡片
- `apps/web/src/components/article/WechatDetailPanel.tsx` - 微信风格详情面板
- `apps/web/src/components/archive/WechatCategorySidebar.tsx` - 归档页分类侧边栏
- `apps/web/src/components/archive/WechatCategoryPills.tsx` - 归档页分类药丸
- `apps/web/src/lib/categoryColors.ts` - 动态分类颜色生成

### 修改文件
- `apps/web/src/app/globals.css` - CSS变量重构
- `apps/web/src/app/(main)/layout.tsx` - 整体布局重构
- `apps/web/src/components/layout/TabsBar.tsx` - 桌面端Tabs样式
- `apps/web/src/components/layout/TopNav.tsx` - 桌面端顶部导航
- `apps/web/src/components/article/ArticleList.tsx` - 使用新卡片组件
- `apps/web/src/components/content/InboxContent.tsx` - 移动端布局适配
- `apps/web/src/components/content/FavoritesContent.tsx` - 移动端布局适配
- `apps/web/src/components/content/ArchiveContent.tsx` - 使用新分类组件

### 删除文件
- `apps/web/src/components/layout/HorizontalScrollContainer.tsx` - 用SwipeableContainer替代
- `apps/web/src/components/layout/BottomTabBar.tsx` - 用MobileBottomTab替代
- `apps/web/src/components/layout/TabIcons.tsx` - 用Ant Design Icons替代

---

## Phase 1: CSS变量和基础样式

### Task 1.1: 重构CSS变量为微信配色

**Files:**
- Modify: `apps/web/src/app/globals.css:1-100`

- [ ] **Step 1: 安装Ant Design Icons依赖**

Run: `cd apps/web && pnpm add @ant-design/icons`
Expected: 安装成功

- [ ] **Step 2: 更新CSS变量定义**

在 `globals.css` 文件顶部添加/修改以下CSS变量：

```css
/* 微信风格配色 - 浅色模式 */
:root {
  --bg: #ededed;
  --card-bg: #fff;
  --nav-bg: #f7f7f7;
  --text: #000;
  --text-secondary: #191919;
  --text-muted: #888;
  --accent: #07c160;
  --accent-soft: #e8f8e8;
  --border: #d6d6d6;
  --divider: #e5e5e5;
  --tag-bg: #f5f5f5;

  /* 保留原有变量兼容 */
  --muted: #888;
  --glass: rgba(255, 255, 255, 0.85);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.08);
}

/* 微信风格配色 - 深色模式 */
[data-theme="dark"] {
  --bg: #1f1f1f;
  --card-bg: #2c2c2c;
  --nav-bg: #2c2c2c;
  --text: #fff;
  --text-secondary: #b2b2b2;
  --text-muted: #888;
  --accent: #07c160;
  --accent-soft: #1a3a1a;
  --border: #3a3a3a;
  --divider: #3a3a3a;
  --tag-bg: #3a3a3a;

  --muted: #b2b2b2;
  --glass: rgba(44, 44, 44, 0.85);
  --shadow-md: 0 4px 12px rgba(0, 0, 0, 0.3);
}
```

- [ ] **Step 3: 启动开发服务器验证**

Run: `pnpm dev`
Expected: 服务启动成功，访问 http://localhost:1050 检查页面是否正常渲染

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/app/globals.css apps/web/package.json
git commit -m "style: 重构CSS变量为微信风格配色"
```

---

## Phase 2: 移动端基础框架

### Task 2.1: 创建SwipeableContainer滑动容器

**Files:**
- Create: `apps/web/src/components/layout/SwipeableContainer.tsx`

- [ ] **Step 1: 创建SwipeableContainer组件**

```tsx
'use client';

import { useRef, useEffect, useState, type ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';

interface SwipeableContainerProps {
  children: ReactNode[];
  activeIndex: number;
  onIndexChange: (index: number) => void;
  tabKeys: string[];
}

export function SwipeableContainer({
  children,
  activeIndex,
  onIndexChange,
  tabKeys,
}: SwipeableContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const pathname = usePathname();
  const touchStartX = useRef(0);
  const touchEndX = useRef(0);
  const isSwiping = useRef(false);
  const currentIndex = useRef(activeIndex);

  // 程序化滚动到目标页面
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    const targetScroll = activeIndex * container.offsetWidth;

    // 使用 instant 行为避免与用户滑动冲突
    container.scrollTo({ left: targetScroll, behavior: 'instant' });
    currentIndex.current = activeIndex;
  }, [activeIndex]);

  // 初始化位置
  useEffect(() => {
    if (!containerRef.current) return;
    const container = containerRef.current;
    container.scrollLeft = activeIndex * container.offsetWidth;
  }, []);

  // Touch 事件处理
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleTouchStart = (e: TouchEvent) => {
      touchStartX.current = e.touches[0].clientX;
      isSwiping.current = true;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (!isSwiping.current) return;
      isSwiping.current = false;

      touchEndX.current = e.changedTouches[0].clientX;
      const deltaX = touchEndX.current - touchStartX.current;
      const threshold = 50;

      if (Math.abs(deltaX) > threshold) {
        const direction = deltaX > 0 ? -1 : 1; // 向右滑是后退，向左滑是前进
        const newIndex = currentIndex.current + direction;

        if (newIndex >= 0 && newIndex < tabKeys.length) {
          currentIndex.current = newIndex;
          onIndexChange(newIndex);

          // 更新 URL
          const newPath = `/${tabKeys[newIndex]}`;
          if (pathname !== newPath) {
            router.replace(newPath, { scroll: false });
          }
        }
      }
    };

    container.addEventListener('touchstart', handleTouchStart, { passive: true });
    container.addEventListener('touchend', handleTouchEnd, { passive: true });

    return () => {
      container.removeEventListener('touchstart', handleTouchStart);
      container.removeEventListener('touchend', handleTouchEnd);
    };
  }, [onIndexChange, router, pathname, tabKeys]);

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        width: '100vw',
        height: 'calc(100vh - 100px)', // 顶部导航44px + 底部Tab56px
        overflowX: 'auto',
        overflowY: 'hidden',
        scrollSnapType: 'x mandatory',
        scrollbarWidth: 'none',
        WebkitOverflowScrolling: 'touch',
      }}
      className="hide-scrollbar"
    >
      {children.filter(Boolean).map((child, index) => (
        <div
          key={index}
          style={{
            width: '100vw',
            height: '100%',
            flexShrink: 0,
            overflowY: 'auto',
            paddingBottom: '56px',
            boxSizing: 'border-box',
            scrollSnapAlign: 'start',
            scrollSnapStop: 'always',
          }}
        >
          {child}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: 启动服务器验证组件可用**

Run: `pnpm dev`
Expected: 无编译错误

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/components/layout/SwipeableContainer.tsx
git commit -m "feat: 创建SwipeableContainer滑动容器(scroll-snap实现)"
```

---

### Task 2.2: 创建MobileBottomTab底部导航栏

**Files:**
- Create: `apps/web/src/components/layout/MobileBottomTab.tsx`

- [ ] **Step 1: 创建MobileBottomTab组件**

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthContext';
import { AppstoreOutlined, HeartOutlined, FolderOutlined } from '@ant-design/icons';

const tabs = [
  { key: 'inbox', label: '收件箱', href: '/inbox', Icon: AppstoreOutlined },
  { key: 'favorites', label: '收藏', href: '/favorites', Icon: HeartOutlined },
  { key: 'archive', label: '归档', href: '/archive', Icon: FolderOutlined },
];

interface MobileBottomTabProps {
  counts: { inbox: number; favorites: number; archive: number };
  activeIndex: number;
  onTabChange: (index: number) => void;
}

export function MobileBottomTab({ counts, activeIndex, onTabChange }: MobileBottomTabProps) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  if (!isAuthenticated) return null;

  const handleTabClick = (index: number, href: string) => {
    onTabChange(index);
    router.push(href, { scroll: false });
  };

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        height: '56px',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        background: 'var(--nav-bg)',
        borderTop: '0.5px solid var(--border)',
        zIndex: 100,
      }}
    >
      {tabs.map((tab, index) => {
        const isActive = activeIndex === index;
        const count = counts[tab.key as keyof typeof counts] ?? 0;

        return (
          <button
            key={tab.key}
            onClick={() => handleTabClick(index, tab.href)}
            type="button"
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              padding: '8px 0',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <tab.Icon
              style={{
                fontSize: '24px',
                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
              }}
            />
            <span
              style={{
                fontSize: '10px',
                color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                fontWeight: isActive ? 500 : 400,
              }}
            >
              {tab.label}
            </span>
            {count > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '4px',
                  right: 'calc(50% - 20px)',
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#fff',
                  background: 'var(--accent)',
                  padding: '2px 6px',
                  borderRadius: '10px',
                  minWidth: '18px',
                  textAlign: 'center',
                }}
              >
                {count > 99 ? '99+' : count}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/layout/MobileBottomTab.tsx
git commit -m "feat: 创建MobileBottomTab底部导航栏(Ant Design图标)"
```

---

### Task 2.3: 创建MobileTopNav顶部导航

**Files:**
- Create: `apps/web/src/components/layout/MobileTopNav.tsx`

- [ ] **Step 1: 创建MobileTopNav组件**

```tsx
'use client';

import { useState } from 'react';
import { SearchOutlined, PlusOutlined } from '@ant-design/icons';
import { SearchModal } from '@/components/search/SearchModal';

interface MobileTopNavProps {
  onAddClick?: () => void;
}

export function MobileTopNav({ onAddClick }: MobileTopNavProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          height: '44px',
          padding: '0 16px',
          background: 'var(--bg)',
          position: 'sticky',
          top: 0,
          zIndex: 99,
        }}
      >
        {/* 左侧空白占位 */}
        <div style={{ width: '44px' }} />

        {/* 中间：Logo + Storing */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '50%',
              background: 'var(--accent)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <span style={{ color: '#fff', fontSize: '14px', fontWeight: 'bold' }}>S</span>
          </div>
          <span
            style={{
              fontSize: '20px',
              fontWeight: 400,
              color: 'var(--text)',
              fontFamily: "'Brush Script MT', cursive",
            }}
          >
            Storing
          </span>
        </div>

        {/* 右侧：搜索 + 加号 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => setSearchOpen(true)}
            type="button"
            style={{
              background: 'transparent',
              border: 'none',
              padding: '4px',
              cursor: 'pointer',
            }}
          >
            <SearchOutlined style={{ fontSize: '22px', color: 'var(--text)' }} />
          </button>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            type="button"
            style={{
              background: 'transparent',
              border: 'none',
              padding: '4px',
              cursor: 'pointer',
            }}
          >
            <PlusOutlined style={{ fontSize: '22px', color: 'var(--text)' }} />
          </button>

          {/* 下拉菜单 */}
          {menuOpen && (
            <div
              style={{
                position: 'absolute',
                top: '44px',
                right: '16px',
                background: 'var(--card-bg)',
                borderRadius: '8px',
                boxShadow: 'var(--shadow-md)',
                padding: '8px 0',
                minWidth: '120px',
              }}
            >
              <button
                onClick={() => {
                  setSearchOpen(true);
                  setMenuOpen(false);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '12px 16px',
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '14px',
                  color: 'var(--text)',
                }}
              >
                <SearchOutlined style={{ fontSize: '16px' }} />
                搜索
              </button>
              {onAddClick && (
                <button
                  onClick={() => {
                    onAddClick();
                    setMenuOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '12px 16px',
                    width: '100%',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '14px',
                    color: 'var(--text)',
                  }}
                >
                  <PlusOutlined style={{ fontSize: '16px' }} />
                  添加文章
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} />}
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/layout/MobileTopNav.tsx
git commit -m "feat: 创建MobileTopNav顶部导航(Logo+Storing书写体)"
```

---

### Task 2.4: 重构layout.tsx整合移动端组件

**Files:**
- Modify: `apps/web/src/app/(main)/layout.tsx`

- [ ] **Step 1: 重写layout.tsx使用新组件**

```tsx
'use client';

import { useState, useEffect, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { MobileTopNav } from '@/components/layout/MobileTopNav';
import { MobileBottomTab } from '@/components/layout/MobileBottomTab';
import { SwipeableContainer } from '@/components/layout/SwipeableContainer';
import { DesktopTopNav } from '@/components/layout/DesktopTopNav';
import { DesktopTabsBar } from '@/components/layout/DesktopTabsBar';
import { SearchModal } from '@/components/search/SearchModal';
import { ArticleDetailPanel } from '@/components/article/ArticleDetailPanel';
import { ArticleProvider, useArticleContext } from '@/components/providers/ArticleContext';
import { AuthProvider, useAuth } from '@/components/providers/AuthContext';
import { useCounts } from '@/hooks/useCounts';
import { useDoubleBackExit } from '@/hooks/useDoubleBackExit';
import { InboxContent } from '@/components/content/InboxContent';
import { FavoritesContent } from '@/components/content/FavoritesContent';
import { ArchiveContent } from '@/components/content/ArchiveContent';

const TAB_KEYS = ['inbox', 'favorites', 'archive'];

function MainContent({ children }: { children: ReactNode }) {
  const counts = useCounts();
  const { selectedId, closeArticle, mutateList } = useArticleContext();
  const { isLoading, isAuthenticated } = useAuth();
  const pathname = usePathname();

  useDoubleBackExit();

  // 当前 tab 索引
  const activeIndex = TAB_KEYS.findIndex(key => pathname === `/${key}`);
  const [currentTabIndex, setCurrentTabIndex] = useState(activeIndex >= 0 ? activeIndex : 0);

  // 检测是否为移动端
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 登录成功后刷新 counts
  useEffect(() => {
    if (isAuthenticated) {
      counts.refreshCounts();
    }
  }, [isAuthenticated, counts]);

  // 监听路由变化同步 tab 索引
  useEffect(() => {
    const index = TAB_KEYS.findIndex(key => pathname === `/${key}`);
    if (index >= 0) {
      setCurrentTabIndex(index);
    }
  }, [pathname]);

  // 搜索弹窗状态（桌面端）
  const [searchOpen, setSearchOpen] = useState(false);

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
        <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>加载中...</span>
      </div>
    );
  }

  return (
    <>
      {/* 移动端布局 */}
      {isMobile && (
        <>
          <MobileTopNav />
          <SwipeableContainer
            activeIndex={isAuthenticated ? currentTabIndex : 2}
            onIndexChange={(index) => {
              if (isAuthenticated) {
                setCurrentTabIndex(index);
              }
            }}
            tabKeys={TAB_KEYS}
          >
            {isAuthenticated && <InboxContent />}
            {isAuthenticated && <FavoritesContent />}
            <ArchiveContent />
          </SwipeableContainer>
          <MobileBottomTab
            counts={counts}
            activeIndex={currentTabIndex}
            onTabChange={setCurrentTabIndex}
          />
        </>
      )}

      {/* 桌面端布局 */}
      {!isMobile && (
        <>
          <DesktopTopNav onSearchOpen={() => setSearchOpen(true)} />
          <DesktopTabsBar counts={counts} activeIndex={currentTabIndex} onTabChange={setCurrentTabIndex} />
          <main style={{ padding: '24px 0', background: 'var(--bg)' }}>
            <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '0 24px' }}>
              {children}
            </div>
          </main>
        </>
      )}

      {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} />}
      <ArticleDetailPanel articleId={selectedId} onClose={closeArticle} onMutate={mutateList} />
    </>
  );
}

export default function MainLayout({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <ArticleProvider>
        <MainContent>{children}</MainContent>
      </ArticleProvider>
    </AuthProvider>
  );
}
```

- [ ] **Step 2: 验证布局**

Run: `pnpm dev`
访问 http://localhost:1050，切换到移动端视图（<768px）检查：
- 顶部导航显示正确
- 底部Tab栏显示正确
- 滑动切换功能正常

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/app/\(main\)/layout.tsx
git commit -m "refactor: 重构layout整合移动端微信风格组件"
```

---

## Phase 3: 文章组件

### Task 3.1: 创建WechatArticleCard文章卡片

**Files:**
- Create: `apps/web/src/components/article/WechatArticleCard.tsx`

- [ ] **Step 1: 创建WechatArticleCard组件**

```tsx
'use client';

import { useState } from 'react';
import { MoreOutlined, HeartOutlined, HeartFilled, FolderOutlined, FolderFilled } from '@ant-design/icons';
import { DateText } from '@/lib/formatDate';
import { getCategoryColor } from '@/lib/categoryColors';

interface Article {
  id: number;
  title: string;
  author: string | null;
  source: string | null;
  publishTime: string;
  coverImage: string | null;
  isFavorited: boolean;
  isArchived: boolean;
  aiCategory?: string;
}

interface WechatArticleCardProps {
  article: Article;
  onClick: () => void;
  onToggleFavorite: (e: React.MouseEvent) => void;
  onArchive: (e: React.MouseEvent) => void;
  highlight?: boolean;
}

export function WechatArticleCard({ article, onClick, onToggleFavorite, onArchive, highlight }: WechatArticleCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const catColor = article.aiCategory ? getCategoryColor(article.aiCategory) : null;

  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--card-bg)',
        borderRadius: '4px',
        cursor: 'pointer',
        transition: 'opacity 0.2s',
        opacity: highlight ? 0.6 : 1,
      }}
    >
      {/* 封面图 */}
      {article.coverImage && (
        <img
          src={article.coverImage}
          alt=""
          style={{
            width: '100%',
            height: '120px',
            objectFit: 'cover',
            borderRadius: '4px 4px 0 0',
          }}
        />
      )}

      {/* 内容区域 */}
      <div style={{ padding: '12px 16px' }}>
        {/* 第一行：标题 + 三点菜单 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
          <div
            style={{
              fontSize: '17px',
              fontWeight: 500,
              color: 'var(--text)',
              lineHeight: 1.4,
              flex: 1,
            }}
          >
            {article.title}
          </div>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(!menuOpen);
            }}
            type="button"
            style={{
              background: 'transparent',
              border: 'none',
              padding: '4px',
              cursor: 'pointer',
            }}
          >
            <MoreOutlined style={{ fontSize: '20px', color: 'var(--text-muted)' }} />
          </button>
        </div>

        {/* 第三行：作者 + 时间 */}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)' }}>
          <span>{article.author || article.source || '未知来源'}</span>
          <DateText dateStr={article.publishTime} />
        </div>
      </div>

      {/* 下拉菜单 */}
      {menuOpen && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: '40px',
            right: '16px',
            background: 'var(--card-bg)',
            borderRadius: '8px',
            boxShadow: 'var(--shadow-md)',
            padding: '8px 0',
            minWidth: '120px',
            zIndex: 10,
          }}
        >
          <button
            onClick={onToggleFavorite}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 16px',
              width: '100%',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              color: 'var(--text)',
            }}
          >
            {article.isFavorited ? (
              <HeartFilled style={{ fontSize: '16px', color: 'var(--accent)' }} />
            ) : (
              <HeartOutlined style={{ fontSize: '16px' }} />
            )}
            {article.isFavorited ? '取消收藏' : '收藏'}
          </button>
          <button
            onClick={onArchive}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 16px',
              width: '100%',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
              color: 'var(--text)',
            }}
          >
            {article.isArchived ? (
              <FolderFilled style={{ fontSize: '16px', color: 'var(--accent)' }} />
            ) : (
              <FolderOutlined style={{ fontSize: '16px' }} />
            )}
            {article.isArchived ? '移回收件箱' : '归档'}
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/article/WechatArticleCard.tsx
git commit -m "feat: 创建WechatArticleCard文章卡片(微信风格布局)"
```

---

### Task 3.2: 创建动态分类颜色工具函数

**Files:**
- Create: `apps/web/src/lib/categoryColors.ts`

- [ ] **Step 1: 创建动态分类颜色函数**

```ts
// 预设色板（微信风格配色）
const COLOR_PALETTE = [
  { bg: '#e6f7ff', text: '#1890ff' }, // 蓝
  { bg: '#f6ffed', text: '#52c41a' }, // 绿
  { bg: '#fff7e6', text: '#fa8c16' }, // 橙
  { bg: '#f9f0ff', text: '#722ed1' }, // 紫
  { bg: '#fff1f0', text: '#f5222d' }, // 红
  { bg: '#e6fffb', text: '#13c2c2' }, // 青
  { bg: '#fcffe6', text: '#fadb14' }, // 黄
  { bg: '#f0f5ff', text: '#2f54eb' }, // 深蓝
];

// 分类名称到颜色的映射缓存
const categoryColorMap: Record<string, { bg: string; text: string }> = {};
let colorIndex = 0;

export function getCategoryColor(category: string): { bg: string; text: string } {
  if (categoryColorMap[category]) {
    return categoryColorMap[category];
  }

  // 从色板中依次分配颜色
  const color = COLOR_PALETTE[colorIndex % COLOR_PALETTE.length];
  colorIndex++;

  categoryColorMap[category] = color;
  return color;
}

// 重置颜色分配（用于测试）
export function resetCategoryColors(): void {
  colorIndex = 0;
  Object.keys(categoryColorMap).forEach(key => delete categoryColorMap[key]);
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/lib/categoryColors.ts
git commit -m "feat: 创建动态分类颜色工具函数"
```

---

### Task 3.3: 创建WechatDetailPanel详情面板

**Files:**
- Create: `apps/web/src/components/article/WechatDetailPanel.tsx`

- [ ] **Step 1: 创建WechatDetailPanel组件（移动端）**

```tsx
'use client';

import { useEffect, useMemo } from 'react';
import { LeftOutlined, MoreOutlined, HeartOutlined, HeartFilled, FolderOutlined, ShareAltOutlined, LinkOutlined } from '@ant-design/icons';
import { useArticle } from '@/hooks/useArticle';
import { useToast } from '@/components/ui/Toast';
import { useAuth } from '@/components/providers/AuthContext';
import { DateText } from '@/lib/formatDate';
import { api } from '@/lib/api';
import ReactMarkdown from 'react-markdown';

interface WechatDetailPanelProps {
  articleId: number | null;
  onClose: () => void;
  onMutate: () => void;
  isDesktop?: boolean;
}

export function WechatDetailPanel({ articleId, onClose, onMutate, isDesktop }: WechatDetailPanelProps) {
  const { data: article, isLoading, mutate: mutateArticle } = useArticle(articleId);
  const { showToast } = useToast();
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (articleId && !isDesktop) {
      document.body.style.overflow = 'hidden';
      return () => { document.body.style.overflow = ''; };
    }
  }, [articleId, isDesktop]);

  const memoizedContent = useMemo(() => {
    if (!article?.contentMd) return null;
    return <ReactMarkdown>{article.contentMd}</ReactMarkdown>;
  }, [article?.contentMd]);

  if (!articleId) return null;

  // 桌面端：右侧面板样式
  if (isDesktop) {
    return (
      <>
        {/* 遮罩层 */}
        <div
          onClick={onClose}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: '420px',
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.3)',
            backdropFilter: 'blur(2px)',
            zIndex: 200,
          }}
        />
        {/* 详情面板 */}
        <div
          style={{
            position: 'fixed',
            top: 0,
            right: 0,
            width: '420px',
            height: '100vh',
            background: 'var(--card-bg)',
            borderLeft: '1px solid var(--divider)',
            zIndex: 201,
            overflowY: 'auto',
          }}
        >
          <DetailContent
            article={article}
            isLoading={isLoading}
            onClose={onClose}
            onMutate={onMutate}
            mutateArticle={mutateArticle}
            showToast={showToast}
            isAuthenticated={isAuthenticated}
            memoizedContent={memoizedContent}
          />
        </div>
      </>
    );
  }

  // 移动端：全屏面板样式
  return (
    <div
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'var(--card-bg)',
        zIndex: 200,
        overflowY: 'auto',
      }}
    >
      <DetailContent
        article={article}
        isLoading={isLoading}
        onClose={onClose}
        onMutate={onMutate}
        mutateArticle={mutateArticle}
        showToast={showToast}
        isAuthenticated={isAuthenticated}
        memoizedContent={memoizedContent}
      />
    </div>
  );
}

// 详情内容组件
function DetailContent({
  article,
  isLoading,
  onClose,
  onMutate,
  mutateArticle,
  showToast,
  isAuthenticated,
  memoizedContent,
}: {
  article: any;
  isLoading: boolean;
  onClose: () => void;
  onMutate: () => void;
  mutateArticle: () => void;
  showToast: (msg: string) => void;
  isAuthenticated: boolean;
  memoizedContent: React.ReactNode;
}) {
  // 分享功能
  async function handleShare() {
    if (!article) return;
    const url = article.originalUrl || window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: article.title, url });
      } catch {}
    } else {
      await navigator.clipboard.writeText(url);
      showToast('链接已复制');
    }
  }

  // 收藏功能
  async function handleFavorite() {
    if (!article) return;
    await api.toggleFavorite(article.id);
    mutateArticle();
    onMutate();
    showToast(article.isFavorited ? '已取消收藏' : '已收藏');
  }

  // 归档功能
  async function handleArchive() {
    if (!article) return;
    if (article.isArchived) {
      await api.unarchive(article.id);
      showToast('已移回收件箱');
    } else {
      await api.archive(article.id);
      showToast('已归档');
    }
    mutateArticle();
    onMutate();
  }

  return (
    <>
      {/* 顶部导航 */}
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          height: '44px',
          padding: '0 16px',
          background: 'var(--card-bg)',
          borderBottom: '0.5px solid var(--divider)',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <button onClick={onClose} type="button" style={{ background: 'transparent', border: 'none', padding: '4px', cursor: 'pointer' }}>
          <LeftOutlined style={{ fontSize: '22px', color: 'var(--text)' }} />
        </button>
        <button type="button" style={{ background: 'transparent', border: 'none', padding: '4px', cursor: 'pointer' }}>
          <MoreOutlined style={{ fontSize: '22px', color: 'var(--text)', transform: 'rotate(90deg)' }} />
        </button>
      </header>

      {/* 文章内容 */}
      {isLoading ? (
        <div style={{ padding: '16px', color: 'var(--text-muted)' }}>加载中...</div>
      ) : article ? (
        <>
          {/* 文章头部 */}
          <div style={{ padding: '16px' }}>
            <h1 style={{ fontSize: '20px', fontWeight: 500, color: 'var(--text)', lineHeight: 1.5, marginBottom: '8px' }}>
              {article.title}
            </h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px', color: 'var(--text-muted)', marginBottom: '12px' }}>
              <span>{article.source}</span>
              <span style={{ color: 'var(--divider)' }}>·</span>
              {article.author && (
                <>
                  <span>{article.author}</span>
                  <span style={{ color: 'var(--divider)' }}>·</span>
                </>
              )}
              <DateText dateStr={article.publishTime} />
            </div>
            {/* AI标签 */}
            {article.aiTags?.length > 0 && (
              <div style={{ display: 'flex', gap: '8px' }}>
                {article.aiTags.map((tag: string) => (
                  <span key={tag} style={{ padding: '4px 10px', background: 'var(--tag-bg)', color: 'var(--text-muted)', fontSize: '12px', borderRadius: '4px' }}>
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* AI摘要 */}
          {article.aiSummary && (
            <div style={{ padding: '14px 16px', background: 'var(--tag-bg)', margin: '8px 16px', borderRadius: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'var(--accent)' }} />
                <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text)' }}>智能摘要</span>
              </div>
              <p style={{ fontSize: '15px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>{article.aiSummary}</p>
            </div>
          )}

          {/* 正文 */}
          <div style={{ padding: '16px' }}>
            {article.contentMd ? (
              <div style={{ fontSize: '17px', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                {memoizedContent}
              </div>
            ) : (
              <div style={{ color: 'var(--text-muted)' }}>正在加载正文...</div>
            )}
          </div>

          {/* 底部操作栏 */}
          {isAuthenticated && (
            <footer
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                height: '56px',
                padding: '12px 16px',
                background: 'var(--nav-bg)',
                borderTop: '0.5px solid var(--divider)',
                position: 'sticky',
                bottom: 0,
              }}
            >
              {/* 左侧：阅读原文 */}
              {article.originalUrl && (
                <a
                  href={article.originalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    color: 'var(--accent)',
                    textDecoration: 'none',
                    fontSize: '14px',
                  }}
                >
                  <LinkOutlined style={{ fontSize: '18px' }} />
                  阅读原文
                </a>
              )}

              {/* 右侧：操作按钮 */}
              <div style={{ display: 'flex', gap: '24px' }}>
                <button onClick={handleArchive} type="button" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                  <FolderOutlined style={{ fontSize: '20px', color: 'var(--text)' }} />
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{article.isArchived ? '取消归档' : '归档'}</span>
                </button>
                <button onClick={handleShare} type="button" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                  <ShareAltOutlined style={{ fontSize: '20px', color: 'var(--text)' }} />
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>分享</span>
                </button>
                <button onClick={handleFavorite} type="button" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', background: 'transparent', border: 'none', cursor: 'pointer' }}>
                  {article.isFavorited ? (
                    <HeartFilled style={{ fontSize: '20px', color: 'var(--accent)' }} />
                  ) : (
                    <HeartOutlined style={{ fontSize: '20px', color: 'var(--text)' }} />
                  )}
                  <span style={{ fontSize: '11px', color: article.isFavorited ? 'var(--accent)' : 'var(--text-muted)' }}>收藏</span>
                </button>
              </div>
            </footer>
          )}
        </>
      ) : null}
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/article/WechatDetailPanel.tsx
git commit -m "feat: 创建WechatDetailPanel详情面板(移动端+桌面端)"
```

---

## Phase 4: 桌面端组件

### Task 4.1: 创建DesktopTopNav桌面端顶部导航

**Files:**
- Create: `apps/web/src/components/layout/DesktopTopNav.tsx`

- [ ] **Step 1: 创建DesktopTopNav组件**

```tsx
'use client';

import { useState } from 'react';
import { SearchOutlined, UserOutlined, SunOutlined, MoonOutlined, DownOutlined } from '@ant-design/icons';

interface DesktopTopNavProps {
  onSearchOpen: () => void;
}

export function DesktopTopNav({ onSearchOpen }: DesktopTopNavProps) {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  return (
    <header
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        height: '56px',
        padding: '0 24px',
        background: 'var(--bg)',
        borderBottom: '1px solid var(--divider)',
      }}
    >
      {/* 左侧：Logo + Storing */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '6px',
            background: 'var(--accent)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ color: '#fff', fontSize: '16px', fontWeight: 'bold' }}>S</span>
        </div>
        <span
          style={{
            fontSize: '18px',
            fontWeight: 400,
            color: 'var(--text)',
            fontFamily: "'Brush Script MT', cursive",
          }}
        >
          Storing
        </span>
      </div>

      {/* 中间：搜索框 */}
      <div
        onClick={onSearchOpen}
        style={{
          display: 'flex',
          alignItems: 'center',
          background: 'var(--card-bg)',
          borderRadius: '8px',
          padding: '8px 16px',
          width: '300px',
          border: '1px solid var(--border)',
          cursor: 'pointer',
        }}
      >
        <SearchOutlined style={{ fontSize: '16px', color: 'var(--text-muted)' }} />
        <span style={{ fontSize: '14px', color: 'var(--text-muted)', marginLeft: '8px' }}>搜索文章...</span>
      </div>

      {/* 右侧：用户 + 主题 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* 用户下拉 */}
        <div
          onClick={() => setUserMenuOpen(!userMenuOpen)}
          style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}
        >
          <UserOutlined style={{ fontSize: '20px', color: 'var(--text)' }} />
          <span style={{ fontSize: '14px', color: 'var(--text)' }}>admin</span>
          <DownOutlined style={{ fontSize: '12px', color: 'var(--text-muted)' }} />
        </div>

        {/* 主题切换 */}
        <button
          onClick={toggleTheme}
          type="button"
          style={{ background: 'transparent', border: 'none', padding: '4px', cursor: 'pointer' }}
        >
          {theme === 'light' ? (
            <SunOutlined style={{ fontSize: '20px', color: 'var(--text)' }} />
          ) : (
            <MoonOutlined style={{ fontSize: '20px', color: 'var(--text)' }} />
          )}
        </button>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/layout/DesktopTopNav.tsx
git commit -m "feat: 创建DesktopTopNav桌面端顶部导航"
```

---

### Task 4.2: 创建DesktopTabsBar桌面端Tabs导航

**Files:**
- Create: `apps/web/src/components/layout/DesktopTabsBar.tsx`

- [ ] **Step 1: 创建DesktopTabsBar组件**

```tsx
'use client';

import { useRouter } from 'next/navigation';
import { AppstoreOutlined, HeartOutlined, FolderOutlined } from '@ant-design/icons';

const tabs = [
  { key: 'inbox', label: '收件箱', href: '/inbox', Icon: AppstoreOutlined },
  { key: 'favorites', label: '收藏', href: '/favorites', Icon: HeartOutlined },
  { key: 'archive', label: '归档', href: '/archive', Icon: FolderOutlined },
];

interface DesktopTabsBarProps {
  counts: { inbox: number; favorites: number; archive: number };
  activeIndex: number;
  onTabChange: (index: number) => void;
}

export function DesktopTabsBar({ counts, activeIndex, onTabChange }: DesktopTabsBarProps) {
  const router = useRouter();

  const handleTabClick = (index: number, href: string) => {
    onTabChange(index);
    router.push(href, { scroll: false });
  };

  return (
    <div style={{ background: 'var(--card-bg)', borderBottom: '1px solid var(--divider)' }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '0 24px' }}>
        {tabs.map((tab, index) => {
          const isActive = activeIndex === index;
          const count = counts[tab.key as keyof typeof counts] ?? 0;

          return (
            <button
              key={tab.key}
              onClick={() => handleTabClick(index, tab.href)}
              type="button"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '14px 20px',
                background: 'transparent',
                border: 'none',
                borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                cursor: 'pointer',
                transition: 'border-color 0.2s',
              }}
            >
              <tab.Icon
                style={{
                  fontSize: '18px',
                  color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                }}
              />
              <span
                style={{
                  fontSize: '14px',
                  color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                  fontWeight: isActive ? 500 : 400,
                }}
              >
                {tab.label}
              </span>
              <span
                style={{
                  padding: '2px 8px',
                  background: isActive ? 'var(--accent-soft)' : 'var(--tag-bg)',
                  color: isActive ? 'var(--accent)' : 'var(--text-muted)',
                  fontSize: '12px',
                  borderRadius: '10px',
                }}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/layout/DesktopTabsBar.tsx
git commit -m "feat: 创建DesktopTabsBar桌面端Tabs导航"
```

---

## Phase 5: 归档页组件

### Task 5.1: 创建WechatCategorySidebar分类侧边栏

**Files:**
- Create: `apps/web/src/components/archive/WechatCategorySidebar.tsx`

- [ ] **Step 1: 创建WechatCategorySidebar组件**

```tsx
'use client';

import { getCategoryColor } from '@/lib/categoryColors';

interface CategoryCount {
  category: string;
  count: number;
}

interface WechatCategorySidebarProps {
  categories: CategoryCount[];
  activeCategory: string;
  totalCount: number;
  onSelect: (category: string) => void;
}

export function WechatCategorySidebar({
  categories,
  activeCategory,
  totalCount,
  onSelect,
}: WechatCategorySidebarProps) {
  return (
    <aside
      style={{
        width: '240px',
        background: 'var(--card-bg)',
        borderRadius: '8px',
        padding: '16px',
      }}
    >
      <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 500, marginBottom: '12px' }}>
        分类筛选
      </div>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
        {/* 全部 */}
        <li
          onClick={() => onSelect('all')}
          style={{
            padding: '10px 12px',
            borderRadius: '6px',
            fontSize: '14px',
            color: activeCategory === 'all' ? 'var(--accent)' : 'var(--text-secondary)',
            background: activeCategory === 'all' ? 'var(--accent-soft)' : 'transparent',
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

        {/* 各分类 */}
        {categories.map((cat) => {
          const isActive = activeCategory === cat.category;
          const catColor = getCategoryColor(cat.category);

          return (
            <li
              key={cat.category}
              onClick={() => onSelect(cat.category)}
              style={{
                padding: '10px 12px',
                borderRadius: '6px',
                fontSize: '14px',
                color: isActive ? catColor.text : 'var(--text-secondary)',
                background: isActive ? catColor.bg : 'transparent',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '4px',
                cursor: 'pointer',
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: catColor.text,
                  }}
                />
                {cat.category}
              </span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{cat.count}</span>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/archive/WechatCategorySidebar.tsx
git commit -m "feat: 创建WechatCategorySidebar分类侧边栏(动态颜色)"
```

---

### Task 5.2: 创建WechatCategoryPills分类药丸

**Files:**
- Create: `apps/web/src/components/archive/WechatCategoryPills.tsx`

- [ ] **Step 1: 创建WechatCategoryPills组件**

```tsx
'use client';

import { getCategoryColor } from '@/lib/categoryColors';

interface CategoryCount {
  category: string;
  count: number;
}

interface WechatCategoryPillsProps {
  categories: CategoryCount[];
  activeCategory: string;
  totalCount: number;
  onSelect: (category: string) => void;
}

export function WechatCategoryPills({
  categories,
  activeCategory,
  totalCount,
  onSelect,
}: WechatCategoryPillsProps) {
  const allCategories = [{ category: 'all', count: totalCount }, ...categories];

  return (
    <div
      style={{
        display: 'flex',
        gap: '8px',
        padding: '12px 16px',
        background: 'var(--card-bg)',
        overflowX: 'auto',
        scrollbarWidth: 'none',
      }}
      className="hide-scrollbar"
    >
      {allCategories.map((cat) => {
        const isActive = activeCategory === cat.category;
        const catColor = cat.category === 'all'
          ? { bg: 'var(--accent-soft)', text: 'var(--accent)' }
          : getCategoryColor(cat.category);

        return (
          <button
            key={cat.category}
            onClick={() => onSelect(cat.category)}
            type="button"
            style={{
              padding: '6px 14px',
              borderRadius: '999px',
              fontSize: '12px',
              border: `1px solid ${isActive ? catColor.text : 'var(--border)'}`,
              color: isActive ? catColor.text : 'var(--text-secondary)',
              background: isActive ? catColor.bg : 'transparent',
              whiteSpace: 'nowrap',
              cursor: 'pointer',
            }}
          >
            {cat.category === 'all' ? '全部' : cat.category}
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/archive/WechatCategoryPills.tsx
git commit -m "feat: 创建WechatCategoryPills分类药丸(移动端)"
```

---

## Phase 6: 整合与清理

### Task 6.1: 修改ArticleList使用新卡片组件

**Files:**
- Modify: `apps/web/src/components/article/ArticleList.tsx`

- [ ] **Step 1: 重写ArticleList使用WechatArticleCard和响应式Grid**

```tsx
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { WechatArticleCard } from '@/components/article/WechatArticleCard';

interface Article {
  id: number;
  title: string;
  author: string | null;
  source: string | null;
  publishTime: string;
  coverImage: string | null;
  isFavorited: boolean;
  isArchived: boolean;
  aiCategory?: string;
}

interface ArticleListProps {
  articles: Article[];
  currentPage: number;
  totalPages: number;
  emptyTitle?: string;
  onPageChange: (page: number) => void;
  onArticleClick: (id: number) => void;
  onToggleFavorite: (id: number, e: React.MouseEvent) => void;
  onArchive: (id: number, e: React.MouseEvent) => void;
  highlightId?: number | null;
}

export function ArticleList({
  articles,
  currentPage,
  totalPages,
  emptyTitle = '暂无文章',
  onPageChange,
  onArticleClick,
  onToggleFavorite,
  onArchive,
  highlightId,
}: ArticleListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  if (articles.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)' }}>
        {emptyTitle}
      </div>
    );
  }

  return (
    <>
      {/* 响应式网格布局 */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
          gap: '16px',
        }}
      >
        {articles.map((article) => (
          <WechatArticleCard
            key={article.id}
            article={article}
            onClick={() => onArticleClick(article.id)}
            onToggleFavorite={(e) => onToggleFavorite(article.id, e)}
            onArchive={(e) => onArchive(article.id, e)}
            highlight={highlightId === article.id}
          />
        ))}
      </div>

      {/* 分页 */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '24px' }}>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              type="button"
              style={{
                padding: '8px 16px',
                borderRadius: '6px',
                fontSize: '14px',
                background: currentPage === page ? 'var(--accent)' : 'var(--card-bg)',
                color: currentPage === page ? '#fff' : 'var(--text)',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              {page}
            </button>
          ))}
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/article/ArticleList.tsx
git commit -m "refactor: ArticleList使用WechatArticleCard和响应式Grid"
```

---

### Task 6.2: 修改ArchiveContent使用新分类组件

**Files:**
- Modify: `apps/web/src/components/content/ArchiveContent.tsx`

- [ ] **Step 1: 重写ArchiveContent**

```tsx
'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import useSWR, { useSWRConfig } from 'swr';
import { useToast } from '@/components/ui/Toast';
import { useArticleContext } from '@/components/providers/ArticleContext';
import { ArticleList } from '@/components/article/ArticleList';
import { WechatCategorySidebar } from '@/components/archive/WechatCategorySidebar';
import { WechatCategoryPills } from '@/components/archive/WechatCategoryPills';
import { api } from '@/lib/api';

function ArchiveContentInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const page = parseInt(searchParams.get('page') || '1');
  const [activeCat, setActiveCategory] = useState('all');
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const { data, isLoading, mutate } = useSWR(
    `articles:archive:${page}:${activeCat}`,
    () => api.getArticles('archive', page, activeCat),
    { revalidateOnFocus: false }
  );
  const { data: catData } = useSWR('categories', () => api.getCategories(), { revalidateOnFocus: false });
  const { mutate: globalMutate } = useSWRConfig();
  const { showToast } = useToast();
  const { openArticle, highlightId, setMutateFn } = useArticleContext();

  useEffect(() => { setMutateFn(mutate); }, [setMutateFn, mutate]);

  function refreshCounts() {
    globalMutate('count:inbox');
    globalMutate('count:favorites');
    globalMutate('count:archive');
    globalMutate('categories');
  }

  const articles = data?.articles ?? [];
  const totalPages = data?.totalPages ?? 1;
  const categories = catData ?? [];
  const totalCount = categories.reduce((sum: number, c: any) => sum + c.count, 0);

  return (
    <div style={{ padding: '0' }}>
      {/* 移动端：药丸筛选 */}
      {isMobile && (
        <WechatCategoryPills
          categories={categories}
          activeCategory={activeCat}
          totalCount={totalCount}
          onSelect={(cat) => {
            setActiveCategory(cat);
            router.push('/archive?page=1');
          }}
        />
      )}

      {/* 桌面端：侧边栏 + 内容 */}
      {!isMobile && (
        <div style={{ display: 'flex', gap: '24px' }}>
          <WechatCategorySidebar
            categories={categories}
            activeCategory={activeCat}
            totalCount={totalCount}
            onSelect={(cat) => {
              setActiveCategory(cat);
              router.push('/archive?page=1');
            }}
          />
          <div style={{ flex: 1 }}>
            {isLoading ? (
              <div style={{ color: 'var(--text-muted)', padding: '48px 0', textAlign: 'center' }}>加载中...</div>
            ) : (
              <ArticleList
                articles={articles}
                currentPage={page}
                totalPages={totalPages}
                emptyTitle="归档中暂无此类文章"
                onPageChange={(p) => router.push(`/archive?page=${p}`)}
                onArticleClick={(id) => openArticle(id)}
                onToggleFavorite={async (id, e) => {
                  e.stopPropagation();
                  await api.toggleFavorite(id);
                  mutate();
                  refreshCounts();
                  showToast('已收藏');
                }}
                onArchive={async (id, e) => {
                  e.stopPropagation();
                  await api.unarchive(id);
                  mutate();
                  refreshCounts();
                  showToast('已移回收件箱');
                }}
                highlightId={highlightId}
              />
            )}
          </div>
        </div>
      )}

      {/* 移动端：内容列表 */}
      {isMobile && (
        <div style={{ padding: '8px 16px' }}>
          {isLoading ? (
            <div style={{ color: 'var(--text-muted)', padding: '48px 0', textAlign: 'center' }}>加载中...</div>
          ) : (
            <ArticleList
              articles={articles}
              currentPage={page}
              totalPages={totalPages}
              emptyTitle="归档中暂无此类文章"
              onPageChange={(p) => router.push(`/archive?page=${p}`)}
              onArticleClick={(id) => openArticle(id)}
              onToggleFavorite={async (id, e) => {
                e.stopPropagation();
                await api.toggleFavorite(id);
                mutate();
                refreshCounts();
                showToast('已收藏');
              }}
              onArchive={async (id, e) => {
                e.stopPropagation();
                await api.unarchive(id);
                mutate();
                refreshCounts();
                showToast('已移回收件箱');
              }}
              highlightId={highlightId}
            />
          )}
        </div>
      )}
    </div>
  );
}

export function ArchiveContent() {
  return (
    <Suspense fallback={<div style={{ color: 'var(--text-muted)', padding: '48px 0', textAlign: 'center' }}>加载中...</div>}>
      <ArchiveContentInner />
    </Suspense>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/src/components/content/ArchiveContent.tsx
git commit -m "refactor: ArchiveContent使用新分类组件"
```

---

### Task 6.3: 删除旧组件

- [ ] **Step 1: 删除不再需要的组件文件**

```bash
rm apps/web/src/components/layout/HorizontalScrollContainer.tsx
rm apps/web/src/components/layout/BottomTabBar.tsx
rm apps/web/src/components/layout/TabIcons.tsx
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "refactor: 删除旧的滑动容器和Tab图标组件"
```

---

### Task 6.4: 最终验证和测试

- [ ] **Step 1: 启动开发服务器进行全面测试**

Run: `pnpm dev`

验证项目：
1. 移动端（<768px）：
   - 顶部导航显示Logo + Storing书写体
   - 底部Tab栏占满宽度，图标+文字
   - 滑动切换Tab流畅稳定
   - 文章卡片布局正确（封面图在上）
   - 详情页布局正确，底部操作栏固定

2. 桌面端（>768px）：
   - 顶部导航搜索框居中
   - Tabs导航微信绿指示线
   - 文章卡片响应式网格布局
   - 归档页侧边栏240px宽度
   - 详情页右侧面板420px宽度

3. 深色模式：
   - 配色正确切换
   - 所有组件样式正常

- [ ] **Step 2: 构建验证**

Run: `pnpm build`
Expected: 构建成功无错误

- [ ] **Step 3: Commit最终版本**

```bash
git add -A
git commit -m "feat: 完成微信风格UI重构"
```

---

## 实现清单汇总

| Phase | Task | 文件 | 状态 |
|-------|------|------|------|
| 1 | 1.1 CSS变量重构 | globals.css | - |
| 2 | 2.1 SwipeableContainer | SwipeableContainer.tsx | - |
| 2 | 2.2 MobileBottomTab | MobileBottomTab.tsx | - |
| 2 | 2.3 MobileTopNav | MobileTopNav.tsx | - |
| 2 | 2.4 layout.tsx重构 | layout.tsx | - |
| 3 | 3.1 WechatArticleCard | WechatArticleCard.tsx | - |
| 3 | 3.2 categoryColors | categoryColors.ts | - |
| 3 | 3.3 WechatDetailPanel | WechatDetailPanel.tsx | - |
| 4 | 4.1 DesktopTopNav | DesktopTopNav.tsx | - |
| 4 | 4.2 DesktopTabsBar | DesktopTabsBar.tsx | - |
| 5 | 5.1 WechatCategorySidebar | WechatCategorySidebar.tsx | - |
| 5 | 5.2 WechatCategoryPills | WechatCategoryPills.tsx | - |
| 6 | 6.1 ArticleList重构 | ArticleList.tsx | - |
| 6 | 6.2 ArchiveContent重构 | ArchiveContent.tsx | - |
| 6 | 6.3 删除旧组件 | - | - |
| 6 | 6.4 最终验证 | - | - |