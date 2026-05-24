# 移动端滑动切换 Tab 设计

## 背景

移动端用户希望能在列表页通过左右滑动切换收件箱、收藏、归档三个 tab，体验更接近原生 App。

## 目标

- 在文章列表区域和 Tab 栏区域都能左右滑动切换 tab
- 滑动时页面跟随手势移动，松手后吸附到最近的 tab
- 点击 Tab 栏仍可切换
- 滑动切换时 URL 同步更新

## 技术方案

使用 CSS `scroll-snap` + 横向滚动容器实现，理由：
- 实现简单，代码量少
- 原生滚动性能好，手感流畅
- 移动端兼容性好

## 架构调整

### 组件结构

```
(main)/layout.tsx
├── TopNav
├── TabsBar（改造：滑动联动）
└── HorizontalScrollContainer（新增）
    ├── InboxContent
    ├── FavoritesContent
    └── ArchiveContent
└── SearchModal
└── ArticleDetailPanel
```

### 路由处理

路由保持不变（`/inbox`、`/favorites`、`/archive`），但三个页面内容在横向容器中并排渲染，URL 决定初始滚动位置。

滑动切换时同步更新 URL，但不触发 Next.js 重新渲染（使用 `router.replace` 无刷新更新）。

### 响应式

- 移动端（< 640px）：启用滑动容器
- 桌面端：保持原有布局，各页面独立渲染

## 组件设计

### HorizontalScrollContainer

- 横向 flex 容器，宽度 300vw（三屏）
- 每个子页面宽度 100vw
- CSS：
  ```css
  scroll-snap-type: x mandatory;
  overflow-x: auto;
  scrollbar-width: none; /* 隐藏滚动条 */
  ```
- 子页面：`scroll-snap-align: start`
- 监听滚动，计算当前 snap 索引，通知 TabsBar
- 提供 `scrollToTab(index)` 方法供 TabsBar 调用

### TabsBar 改造

- 接收 `onTabChange(key)` 回调，点击时调用容器滚动方法
- 接收 `activeKey`，滑动时由容器同步更新
- Tab 栏本身也支持左右滑动（同一个滚动容器或独立的滑动检测）

### 列表页组件提取

从 `inbox/page.tsx`、`favorites/page.tsx`、`archive/page.tsx` 提取内容组件：
- `InboxContent` — 原页面核心逻辑
- `FavoritesContent` — 原页面核心逻辑
- `ArchiveContent` — 原页面核心逻辑

页面文件改为导入对应组件，保持路由入口。

## 实现步骤

1. 创建 `HorizontalScrollContainer` 组件
2. 提取三个列表页的内容组件
3. 改造 `(main)/layout.tsx`，集成滑动容器
4. 改造 `TabsBar`，添加滑动联动
5. 处理 URL 同步和响应式布局
6. 测试移动端滑动体验