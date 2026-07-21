# 移动端底部 Tab 栏实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为移动端添加 iOS 原生风格的底部 Tab 栏，替代顶部 TabsBar。

**Architecture:** 新建 BottomTabBar 和 TabIcons 组件，在 layout.tsx 中响应式显示。移动端用 fixed 定位的底部导航栏，桌面端保持现有 TabsBar。

**Tech Stack:** React TypeScript、CSS、SVG 图标

---

## 文件结构

| 文件 | 操作 | 责任 |
|------|------|------|
| `apps/web/src/components/layout/TabIcons.tsx` | 新建 | SF Symbols 风格 SVG 图标组件 |
| `apps/web/src/components/layout/BottomTabBar.tsx` | 新建 | 底部 Tab 栏组件 |
| `apps/web/src/app/(main)/layout.tsx` | 修改 | 响应式显示 BottomTabBar/TabsBar |
| `apps/web/src/app/globals.css` | 修改 | 添加底部 Tab 栏样式覆盖 |

---

### Task 1: 创建 TabIcons.tsx（SVG 图标组件）

**Files:**
- Create: `apps/web/src/components/layout/TabIcons.tsx`

- [ ] **Step 1: 创建 TabIcons.tsx 文件**

```typescript
'use client';

// SF Symbols 风格图标组件

interface IconProps {
  size?: number;
  strokeWidth?: number;
  color?: string;
}

export function TrayIcon({ size = 24, strokeWidth = 1.5, color = 'currentColor' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* 托盘底部 */}
      <rect x="3" y="6" width="18" height="15" rx="2" />
      {/* 顶部两条横线表示内容 */}
      <line x1="7" y1="10" x2="17" y2="10" />
      <line x1="7" y1="14" x2="17" y2="14" />
    </svg>
  );
}

export function HeartIcon({ size = 24, strokeWidth = 1.5, color = 'currentColor' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* iOS 心形轮廓 */}
      <path d="M12 21C12 21 3 14 3 8.5C3 5.5 5.5 3 8.5 3C10.5 3 12 4.5 12 4.5C12 4.5 13.5 3 15.5 3C18.5 3 21 5.5 21 8.5C21 14 12 21 12 21Z" />
    </svg>
  );
}

export function ArchiveBoxIcon({ size = 24, strokeWidth = 1.5, color = 'currentColor' }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {/* 箱子主体 */}
      <rect x="3" y="7" width="18" height="14" rx="2" />
      {/* 盖板 */}
      <path d="M3 7L5 3H19L21 7" />
      {/* 盖板横线 */}
      <line x1="12" y3="3" x2="12" y2="7" />
      {/* 内部箭头（归档动作） */}
      <polyline points="8 11 12 15 16 11" />
    </svg>
  );
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

运行: `pnpm lint --filter web`
预期: 无 TypeScript 错误

- [ ] **Step 3: 提交 TabIcons 组件**

```bash
git add apps/web/src/components/layout/TabIcons.tsx
git commit -m "feat: 创建 SF Symbols 风格 Tab 图标组件"
```

---

### Task 2: 创建 BottomTabBar.tsx（底部 Tab 栏组件）

**Files:**
- Create: `apps/web/src/components/layout/BottomTabBar.tsx`

- [ ] **Step 1: 创建 BottomTabBar.tsx 文件**

```typescript
'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/providers/AuthContext';
import { TrayIcon, HeartIcon, ArchiveBoxIcon } from './TabIcons';
import { TAB_KEYS } from './HorizontalScrollContainer';

const tabs = [
  { key: 'inbox', label: '收件箱', href: '/inbox', Icon: TrayIcon },
  { key: 'favorites', label: '收藏', href: '/favorites', Icon: HeartIcon },
  { key: 'archive', label: '归档', href: '/archive', Icon: ArchiveBoxIcon },
];

interface BottomTabBarProps {
  counts: { inbox: number; favorites: number; archive: number };
  activeIndex: number;
  onTabChange: (index: number) => void;
  scrollProgress?: number;
}

export function BottomTabBar({ counts, activeIndex, onTabChange, scrollProgress }: BottomTabBarProps) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();

  // 游客模式下完全隐藏
  if (!isAuthenticated) {
    return null;
  }

  // 根据滚动进度计算当前活动索引
  const currentIndex = scrollProgress !== undefined ? Math.round(scrollProgress) : activeIndex;

  const handleTabClick = (index: number, href: string) => {
    onTabChange(index);
    router.push(href, { scroll: false });
  };

  return (
    <nav
      className="bottom-tab-bar"
      style={{
        position: 'fixed',
        bottom: 0,
        width: '100vw',
        height: 56,
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        background: 'var(--glass)',
        backdropFilter: 'blur(20px) saturate(1.4)',
        borderTop: '1px solid var(--glass-border)',
        zIndex: 50,
      }}
    >
      {tabs.map((tab, index) => {
        const isActive = currentIndex === index;
        const count = counts[tab.key as keyof typeof counts] ?? 0;
        const color = isActive ? 'var(--accent)' : 'var(--muted)';

        return (
          <button
            key={tab.key}
            onClick={() => handleTabClick(index, tab.href)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '8px 0',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              position: 'relative',
            }}
          >
            {/* 图标 */}
            <tab.Icon size={24} color={color} />
            
            {/* 数字徽章 */}
            {count > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: 4,
                  right: 'calc(50% - 16px)',
                  minWidth: 12,
                  height: 12,
                  padding: '0 4px',
                  fontSize: 10,
                  fontWeight: 500,
                  color: 'white',
                  background: 'var(--accent)',
                  borderRadius: 999,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {count > 99 ? '99+' : count}
              </span>
            )}

            {/* 文字标签 */}
            <span
              style={{
                fontSize: 11,
                fontWeight: isActive ? 500 : 400,
                color: color,
                marginTop: 2,
              }}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2: 验证 TypeScript 编译**

运行: `pnpm lint --filter web`
预期: 无 TypeScript 错误

- [ ] **Step 3: 提交 BottomTabBar 组件**

```bash
git add apps/web/src/components/layout/BottomTabBar.tsx
git commit -m "feat: 创建 iOS 原生风格底部 Tab 栏组件"
```

---

### Task 3: 修改 layout.tsx（响应式显示）

**Files:**
- Modify: `apps/web/src/app/(main)/layout.tsx`

- [ ] **Step 1: 在 layout.tsx 中导入 BottomTabBar**

在文件顶部导入区域添加：

```typescript
import { BottomTabBar } from '@/components/layout/BottomTabBar';
```

- [ ] **Step 2: 添加移动端检测状态**

在 MainContent 函数中，替换第 73-74 行：

```typescript
// 检测是否为移动端（< 640px）
const [isMobile, setIsMobile] = useState(false);

useEffect(() => {
  const checkMobile = () => setIsMobile(window.innerWidth < 640);
  checkMobile();
  window.addEventListener('resize', checkMobile);
  return () => window.removeEventListener('resize', checkMobile);
}, []);
```

- [ ] **Step 3: 修改渲染逻辑，响应式显示 Tab 栏**

修改第 76-108 行的 return 部分：

```typescript
return (
    <>
      <TopNav onSearchOpen={() => setSearchOpen(true)} />
      {/* 桌面端：显示顶部 TabsBar */}
      {!isMobile && (
        <TabsBar counts={counts} activeIndex={currentTabIndex} onTabChange={setCurrentTabIndex} scrollProgress={scrollProgress} />
      )}
      <main>
        {/* 移动端：使用滑动容器 */}
        <div className="mobile-swipe-view" style={{ display: isMobile ? 'block' : 'none' }}>
          <HorizontalScrollContainer
            activeIndex={isAuthenticated ? currentTabIndex : 0}
            onIndexChange={(index) => {
              if (isAuthenticated) {
                setCurrentTabIndex(index);
              }
            }}
            onScrollProgress={isAuthenticated ? setScrollProgress : undefined}
          >
            {isAuthenticated && <InboxContent />}
            {isAuthenticated && <FavoritesContent />}
            <ArchiveContent />
          </HorizontalScrollContainer>
        </div>
        {/* 桌面端：保持原有布局 */}
        <div className="desktop-view" style={{ display: isMobile ? 'none' : 'block', padding: 'var(--gap-md) 0 var(--gap-xl)' }}>
          <div className="mx-auto" style={{ maxWidth: 'var(--container)', paddingInline: 'var(--gutter)', position: 'relative', zIndex: 1 }}>
            {children}
          </div>
        </div>
      </main>
      {/* 移动端：显示底部 BottomTabBar */}
      {isMobile && (
        <BottomTabBar counts={counts} activeIndex={currentTabIndex} onTabChange={setCurrentTabIndex} scrollProgress={scrollProgress} />
      )}
      {searchOpen && <SearchModal onClose={() => setSearchOpen(false)} />}
      <ArticleDetailPanel articleId={selectedId} onClose={closeArticle} onMutate={mutateList} />
    </>
  );
```

- [ ] **Step 4: 验证 TypeScript 编译**

运行: `pnpm lint --filter web`
预期: 无 TypeScript 错误

- [ ] **Step 5: 提交 layout.tsx 修改**

```bash
git add apps/web/src/app/(main)/layout.tsx
git commit -m "feat: 响应式显示底部 Tab 栏（移动端）和顶部 TabsBar（桌面端）"
```

---

### Task 4: 修改 globals.css（底部 Tab 栏样式）

**Files:**
- Modify: `apps/web/src/app/globals.css`

- [ ] **Step 1: 在 globals.css 文件末尾添加底部 Tab 栏样式**

在文件末尾添加：

```css
/* ===== 底部 Tab 栏样式 ===== */

/* 玻璃主题适配 */
[data-color-scheme='glass'] .bottom-tab-bar {
  background: color-mix(in oklch, var(--surface) 85%, transparent);
  border-top: 1px solid var(--glass-border-glow);
}

/* 隐藏桌面端移动端视图 */
@media (min-width: 640px) {
  .mobile-swipe-view {
    display: none !important;
  }
  .bottom-tab-bar {
    display: none !important;
  }
}

/* 移动端隐藏桌面端视图 */
@media (max-width: 639px) {
  .desktop-view {
    display: none !important;
  }
}
```

- [ ] **Step 2: 验证 CSS 语法**

运行: `pnpm lint --filter web`
预期: 无 CSS 相关错误

- [ ] **Step 3: 提交 globals.css 修改**

```bash
git add apps/web/src/app/globals.css
git commit -m "feat: 添加底部 Tab 栏 CSS 样式和响应式媒体查询"
```

---

### Task 5: 验证并测试

**Files:**
- 无文件修改（验证任务）

- [ ] **Step 1: 启动开发服务器**

运行: `pnpm dev`
预期: 前端启动

- [ ] **Step 2: 在浏览器中测试移动端底部 Tab 栏**

1. 打开页面，调整浏览器窗口宽度至 < 640px 或使用移动端模拟器
2. 验证底部显示 BottomTabBar，顶部 TabsBar 隐藏
3. 点击底部 Tab 切换页面，验证 URL 更新和页面切换
4. 水平滑动页面，验证底部 Tab 活动状态实时跟随
5. 验证数字徽章正确显示

- [ ] **Step 3: 在浏览器中测试桌面端 TabsBar**

1. 调整浏览器窗口宽度至 ≥ 640px
2. 验证顶部显示 TabsBar，底部 BottomTabBar 隐藏
3. 点击顶部 Tab 切换页面，验证正常工作

- [ ] **Step 4: 测试游客模式**

1. 登出账号（游客模式）
2. 验证底部 BottomTabBar 完全隐藏
3. 验证只能访问归档页面

- [ ] **Step 5: 测试玻璃主题适配**

1. 登录账号，切换到玻璃主题
2. 验证底部 Tab 栏背景和边框样式正确

- [ ] **Step 6: 停止开发服务器**

- [ ] **Step 7: 创建最终提交（如有遗漏）**

```bash
git status --short
git add -A
git commit -m "feat: 移动端底部 Tab 栏完成"
```

---

## 计划自审

1. **Spec coverage:**
   - SF Symbols 图标 → Task 1 ✅
   - BottomTabBar 组件 → Task 2 ✅
   - 响应式显示 → Task 3 ✅
   - 玻璃主题适配 → Task 4 ✅
   - 滑动联动 → Task 2, 3 ✅
   - 游客模式隐藏 → Task 2 ✅
   - 数字徽章 → Task 2 ✅

2. **Placeholder scan:** 无 TBD/TODO，所有代码完整 ✅

3. **Type consistency:** TAB_KEYS 在 HorizontalScrollContainer 和 BottomTabBar 中一致 ✅