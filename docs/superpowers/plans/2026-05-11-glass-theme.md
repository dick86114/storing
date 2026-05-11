# macOS Tahoe 液态玻璃主题实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 Storing 添加 macOS Tahoe 风格的液态玻璃配色方案，全面覆盖所有 UI 元素。

**Architecture:** 在现有四季主题 CSS 变量架构基础上，新增 `glass` 配色方案。通过扩展 globals.css 中的 CSS 变量实现液态玻璃效果，修改 ThemeProvider 类型定义和 TopNav 配色选项，零组件代码改动。

**Tech Stack:** CSS 变量（oklch 色彩空间）、backdrop-filter、React TypeScript

---

## 文件结构

| 文件 | 操作 | 责任 |
|------|------|------|
| `apps/web/src/app/globals.css` | 修改 | 添加 glass 配色方案的 CSS 变量和组件样式覆盖 |
| `apps/web/src/components/providers/ThemeProvider.tsx` | 修改 | ColorScheme 类型添加 'glass' |
| `apps/web/src/components/layout/TopNav.tsx` | 修改 | COLOR_SCHEMES 数组添加玻璃选项 |

---

### Task 1: 添加 glass 配色方案 CSS 变量（浅色模式）

**Files:**
- Modify: `apps/web/src/app/globals.css`（在冬季主题样式块后添加）

- [ ] **Step 1: 在 globals.css 中添加 glass 浅色模式 CSS 变量**

在 `[data-color-scheme='winter'][data-theme='dark']` 样式块结束后（约第 965 行），添加以下样式块：

```css
/* ===== 玻璃配色：macOS Tahoe 液态玻璃 ===== */
/* 蓝紫冷色调 + 多层半透明 + 边缘光晕 + 内部高光折射 */

[data-color-scheme='glass'][data-theme='light'],
[data-color-scheme='glass']:not([data-theme='dark']) {
  /* 基础配色 */
  --bg: oklch(97% 0.015 280);
  --surface: oklch(98% 0.010 280);
  --surface-alt: oklch(96% 0.018 275);
  --fg: oklch(20% 0.015 270);
  --fg-title: oklch(15% 0.018 270);
  --muted: oklch(48% 0.012 280);
  --border: oklch(88% 0.012 280);
  --accent: oklch(55% 0.25 270);
  --accent-alt: oklch(52% 0.22 290);

  /* 衍生配色 */
  --accent-soft: color-mix(in oklch, var(--accent) 15%, transparent);
  --fg-soft: color-mix(in oklch, var(--fg) 6%, transparent);

  /* 液态玻璃核心参数 */
  --glass-blur: 24px;
  --glass-saturate: 1.6;
  --glass-opacity: 0.72;
  --glass: color-mix(in oklch, var(--surface) var(--glass-opacity), transparent);
  --glass-border: color-mix(in oklch, var(--border) 60%, transparent);

  /* 高光与光晕 */
  --glass-inner-glow: inset 0 1px 1px oklch(100% 0 0 0.15);
  --glass-specular: linear-gradient(180deg, oklch(100% 0 0 0.08), transparent 50%);
  --glass-border-glow: color-mix(in oklch, var(--accent) 25%, transparent);
  --surface-glow: oklch(98% 0.010 280);

  /* 阴影系统（带紫色调） */
  --shadow-sm: 0 2px 4px oklch(30% 0.015 280 0.08);
  --shadow-md: 0 6px 16px oklch(30% 0.018 280 0.12);
  --shadow-lg: 0 16px 40px oklch(30% 0.020 280 0.16);
  --shadow-glass: 0 8px 24px oklch(25% 0.018 270 0.15);
  --shadow-elevated: 0 12px 32px oklch(55% 0.25 270 0.20);

  /* 圆角系统（Tahoe 风格更大圆角） */
  --radius: 16px;
  --radius-lg: 24px;
  --radius-xl: 32px;
  --radius-sm: 10px;

  /* 字体与排版 */
  --fs-h1: clamp(34px, 4.5vw, 52px);
  --fs-h2: clamp(26px, 3.2vw, 36px);
  --fs-h3: 18px;
  --fs-body: 15px;
  --fs-meta: 12px;
  --font-display: 'Söhne', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  --letter-spacing-title: -0.02em;
  --line-height: 1.6;
}
```

- [ ] **Step 2: 验证 CSS 语法正确**

运行: `pnpm lint`
预期: 无 CSS 相关错误

- [ ] **Step 3: 提交浅色模式变量**

```bash
git add apps/web/src/app/globals.css
git commit -m "feat(glass-theme): 添加玻璃配色浅色模式 CSS 变量"
```

---

### Task 2: 添加 glass 配色方案 CSS 变量（深色模式）

**Files:**
- Modify: `apps/web/src/app/globals.css`（接续 Task 1 的样式块）

- [ ] **Step 1: 在浅色模式样式块后添加深色模式 CSS 变量**

```css
[data-color-scheme='glass'][data-theme='dark'] {
  /* 基础配色 */
  --bg: oklch(18% 0.020 280);
  --surface: oklch(24% 0.018 280);
  --surface-alt: oklch(28% 0.022 275);
  --fg: oklch(94% 0.010 280);
  --fg-title: oklch(98% 0.012 270);
  --muted: oklch(70% 0.010 280);
  --border: oklch(32% 0.015 280);
  --accent: oklch(72% 0.28 270);
  --accent-alt: oklch(70% 0.25 290);

  /* 衍生配色 */
  --accent-soft: color-mix(in oklch, var(--accent) 22%, transparent);
  --fg-soft: color-mix(in oklch, var(--fg) 10%, transparent);

  /* 液态玻璃核心参数（深色模式更强模糊） */
  --glass-blur: 28px;
  --glass-saturate: 1.8;
  --glass-opacity: 0.68;
  --glass: color-mix(in oklch, var(--surface) var(--glass-opacity), transparent);
  --glass-border: color-mix(in oklch, var(--border) 50%, transparent);

  /* 高光与光晕（深色模式光晕更明显） */
  --glass-inner-glow: inset 0 1px 2px oklch(100% 0 0 0.08);
  --glass-specular: linear-gradient(180deg, oklch(100% 0 0 0.06), transparent 40%);
  --glass-border-glow: color-mix(in oklch, var(--accent) 35%, transparent);
  --surface-glow: oklch(24% 0.018 280);

  /* 阴影系统（深色模式更重） */
  --shadow-sm: 0 2px 4px rgba(0, 0, 0, 0.25);
  --shadow-md: 0 6px 16px rgba(0, 0, 0, 0.35);
  --shadow-lg: 0 16px 40px rgba(0, 0, 0, 0.45);
  --shadow-glass: 0 8px 24px oklch(72% 0.28 270 0.18);
  --shadow-elevated: 0 12px 32px oklch(72% 0.28 270 0.25);

  /* 圆角系统 */
  --radius: 16px;
  --radius-lg: 24px;
  --radius-xl: 32px;
  --radius-sm: 10px;

  /* 字体与排版 */
  --fs-h1: clamp(34px, 4.5vw, 52px);
  --fs-h2: clamp(26px, 3.2vw, 36px);
  --fs-h3: 18px;
  --fs-body: 15px;
  --fs-meta: 12px;
  --font-display: 'Söhne', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  --letter-spacing-title: -0.02em;
  --line-height: 1.6;
}
```

- [ ] **Step 2: 验证 CSS 语法正确**

运行: `pnpm lint`
预期: 无 CSS 相关错误

- [ ] **Step 3: 提交深色模式变量**

```bash
git add apps/web/src/app/globals.css
git commit -m "feat(glass-theme): 添加玻璃配色深色模式 CSS 变量"
```

---

### Task 3: 添加组件样式覆盖（导航栏和卡片）

**Files:**
- Modify: `apps/web/src/app/globals.css`（在深色模式样式块后添加）

- [ ] **Step 1: 添加导航栏液态玻璃样式覆盖**

```css
/* ===== 玻璃主题组件样式覆盖 ===== */

/* 导航栏液态玻璃效果 */
[data-color-scheme='glass'] header,
[data-color-scheme='glass'] .sticky.top-0 {
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
  background: var(--glass);
  border-bottom: 1px solid var(--glass-border-glow);
  box-shadow: var(--glass-inner-glow), var(--shadow-sm);
}

[data-color-scheme='glass'] header::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: var(--glass-specular);
  opacity: 0.6;
}
```

- [ ] **Step 2: 添加文章卡片液态玻璃样式**

```css
/* 文章卡片液态玻璃效果 */
[data-color-scheme='glass'] .article-card {
  background: var(--glass);
  border: 1px solid var(--glass-border);
  box-shadow: var(--glass-inner-glow), var(--shadow-glass);
  backdrop-filter: blur(12px) saturate(1.4);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

[data-color-scheme='glass'] .article-card:hover {
  border-color: var(--glass-border-glow);
  box-shadow: var(--glass-inner-glow), var(--shadow-elevated);
  transform: scale(1.02);
  filter: brightness(1.05);
}

/* 卡片标签玻璃胶囊样式 */
[data-color-scheme='glass'] .article-card-tag {
  background: color-mix(in oklch, var(--accent) 12%, transparent);
  border: 1px solid var(--glass-border-glow);
  border-radius: 12px;
  padding: 3px 10px;
  color: var(--accent);
  font-size: 11px;
}
```

- [ ] **Step 3: 验证样式正确**

运行: `pnpm lint`
预期: 无错误

- [ ] **Step 4: 提交导航栏和卡片样式**

```bash
git add apps/web/src/app/globals.css
git commit -m "feat(glass-theme): 添加导航栏和卡片液态玻璃样式覆盖"
```

---

### Task 4: 添加组件样式覆盖（按钮和详情面板）

**Files:**
- Modify: `apps/web/src/app/globals.css`（接续 Task 3 的样式块）

- [ ] **Step 1: 添加按钮液态玻璃样式**

```css
/* 按钮液态玻璃效果 */
[data-color-scheme='glass'] button {
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

[data-color-scheme='glass'] button:not([class*='article-card']):not(.detail-panel-close-btn):not(.detail-panel-action-btn) {
  background: var(--glass);
  border: 1px solid var(--glass-border);
  box-shadow: var(--glass-inner-glow);
  backdrop-filter: blur(8px);
}

[data-color-scheme='glass'] button:not([class*='article-card']):not(.detail-panel-close-btn):not(.detail-panel-action-btn):hover {
  border-color: var(--glass-border-glow);
  filter: brightness(1.1);
  box-shadow: var(--glass-inner-glow), 0 4px 12px oklch(55% 0.25 270 0.15);
}
```

- [ ] **Step 2: 添加详情面板液态玻璃样式**

```css
/* 详情面板液态玻璃效果 */
[data-color-scheme='glass'] .detail-panel {
  background: var(--glass);
  border-left: 1px solid var(--glass-border-glow);
  box-shadow: var(--shadow-lg), inset 4px 0 0 var(--glass-border-glow);
  backdrop-filter: blur(var(--glass-blur)) saturate(var(--glass-saturate));
}

[data-color-scheme='glass'] .detail-panel-header {
  background: var(--glass);
  border-bottom: 1px solid var(--glass-border);
  box-shadow: var(--glass-inner-glow);
}

[data-color-scheme='glass'] .detail-panel-title {
  font-family: var(--font-display);
  letter-spacing: var(--letter-spacing-title);
  color: var(--fg-title);
}

/* 详情面板关闭/操作按钮 */
[data-color-scheme='glass'] .detail-panel-close-btn,
[data-color-scheme='glass'] .detail-panel-action-btn {
  background: var(--glass);
  border: 1px solid var(--glass-border);
  box-shadow: var(--glass-inner-glow);
  transition: all 0.2s ease;
}

[data-color-scheme='glass'] .detail-panel-close-btn:hover,
[data-color-scheme='glass'] .detail-panel-action-btn:hover {
  background: color-mix(in oklch, var(--accent) 15%, var(--glass));
  border-color: var(--glass-border-glow);
}
```

- [ ] **Step 3: 验证样式正确**

运行: `pnpm lint`
预期: 无错误

- [ ] **Step 4: 提交按钮和详情面板样式**

```bash
git add apps/web/src/app/globals.css
git commit -m "feat(glass-theme): 添加按钮和详情面板液态玻璃样式覆盖"
```

---

### Task 5: 添加组件样式覆盖（弹窗、菜单和其他元素）

**Files:**
- Modify: `apps/web/src/app/globals.css`（接续 Task 4 的样式块）

- [ ] **Step 1: 添加弹窗和菜单液态玻璃样式**

```css
/* 弹窗/菜单液态玻璃效果 */
[data-color-scheme='glass'] .article-card-menu,
[data-color-scheme='glass'] [style*="position: absolute"][style*="min-width"] {
  background: var(--glass);
  border: 1px solid var(--glass-border-glow);
  box-shadow: var(--shadow-lg);
  backdrop-filter: blur(32px) saturate(2);
}

[data-color-scheme='glass'] .article-card-menu-item,
[data-color-scheme='glass'] button[style*="width: 100%"][style*="padding: 8px"] {
  border-radius: var(--radius-sm);
  transition: background 0.15s ease;
}

[data-color-scheme='glass'] .article-card-menu-item:hover,
[data-color-scheme='glass'] button[style*="width: 100%"][style*="padding: 8px"]:hover {
  background: color-mix(in oklch, var(--accent) 20%, transparent);
}

/* 搜索按钮玻璃效果 */
[data-color-scheme='glass'] button[aria-label="搜索"] {
  background: var(--glass);
  border: 1px solid var(--glass-border);
  box-shadow: var(--glass-inner-glow);
  backdrop-filter: blur(12px);
}

[data-color-scheme='glass'] button[aria-label="搜索"]:hover {
  border-color: var(--glass-border-glow);
  filter: brightness(1.08);
}
```

- [ ] **Step 2: 添加 AI 摘要块和其他辅助元素样式**

```css
/* AI 摘要块玻璃效果 */
[data-color-scheme='glass'] .ai-summary-block {
  background: var(--glass);
  border: 1px solid var(--glass-border);
  box-shadow: var(--glass-inner-glow), var(--shadow-md);
  backdrop-filter: blur(16px);
}

[data-color-scheme='glass'] .ai-summary-title {
  color: var(--accent);
  border-bottom: 1px solid var(--glass-border);
}

/* 加载占位符玻璃效果 */
[data-color-scheme='glass'] .ai-loading-placeholder,
[data-color-scheme='glass'] .skeleton-card,
[data-color-scheme='glass'] .skeleton-line {
  background: var(--glass);
  border: 1px solid var(--glass-border);
  box-shadow: var(--glass-inner-glow);
}

/* 分隔线玻璃风格 */
[data-color-scheme='glass'] .content-divider {
  border-top: 1px solid var(--glass-border);
}
```

- [ ] **Step 3: 添加骨架屏和过渡效果**

```css
/* 玻璃主题骨架屏 */
[data-color-scheme='glass'] .skeleton-card {
  background: linear-gradient(
    90deg,
    color-mix(in oklch, var(--accent) 8%, transparent) 25%,
    color-mix(in oklch, var(--accent) 15%, transparent) 50%,
    color-mix(in oklch, var(--accent) 8%, transparent) 75%
  );
  background-size: 200% 100%;
  animation: shimmer 1.5s ease-in-out infinite;
}

/* 详情面板遮罩玻璃效果 */
[data-color-scheme='glass'] .detail-panel-overlay {
  background: color-mix(in oklch, var(--bg) 50%, transparent);
  backdrop-filter: blur(4px);
}

/* 高亮卡片发光效果 */
[data-color-scheme='glass'] .article-card.highlighted {
  border-color: var(--glass-border-glow);
  box-shadow: var(--glass-inner-glow), 0 0 20px 4px color-mix(in oklch, var(--accent) 30%, transparent);
}
```

- [ ] **Step 4: 验证样式正确**

运行: `pnpm lint`
预期: 无错误

- [ ] **Step 5: 提交弹窗、菜单和其他元素样式**

```bash
git add apps/web/src/app/globals.css
git commit -m "feat(glass-theme): 添加弹窗、菜单、AI摘要块等液态玻璃样式覆盖"
```

---

### Task 6: 修改 ThemeProvider 类型定义

**Files:**
- Modify: `apps/web/src/components/providers/ThemeProvider.tsx:6`

- [ ] **Step 1: 修改 ColorScheme 类型添加 'glass'**

将第 6 行的类型定义修改为：

```typescript
type ColorScheme = 'default' | 'spring' | 'summer' | 'autumn' | 'winter' | 'glass';
```

- [ ] **Step 2: 验证 TypeScript 编译正确**

运行: `pnpm lint`
预期: 无 TypeScript 错误

- [ ] **Step 3: 提交 ThemeProvider 修改**

```bash
git add apps/web/src/components/providers/ThemeProvider.tsx
git commit -m "feat(glass-theme): ColorScheme 类型添加 'glass'"
```

---

### Task 7: 修改 TopNav 配色选项数组

**Files:**
- Modify: `apps/web/src/components/layout/TopNav.tsx:9-15`

- [ ] **Step 1: 修改 COLOR_SCHEMES 数组添加玻璃选项**

将第 9-15 行的数组修改为：

```typescript
const COLOR_SCHEMES = [
  { key: 'default', label: '默认', icon: '◐' },
  { key: 'spring', label: '春', icon: '🌸' },
  { key: 'summer', label: '夏', icon: '☀️' },
  { key: 'autumn', label: '秋', icon: '🍂' },
  { key: 'winter', label: '冬', icon: '❄' },
  { key: 'glass', label: '玻璃', icon: '💎' },
];
```

- [ ] **Step 2: 验证 TypeScript 编译正确**

运行: `pnpm lint`
预期: 无 TypeScript 错误

- [ ] **Step 3: 提交 TopNav 修改**

```bash
git add apps/web/src/components/layout/TopNav.tsx
git commit -m "feat(glass-theme): 配色方案菜单添加玻璃选项"
```

---

### Task 8: 验证并测试主题效果

**Files:**
- 无文件修改（验证任务）

- [ ] **Step 1: 启动开发服务器**

运行: `pnpm dev`
预期: 前端启动在 http://localhost:1050

- [ ] **Step 2: 在浏览器中测试玻璃主题**

1. 打开 http://localhost:1050
2. 点击导航栏右侧的主题切换按钮
3. 在配色方案中选择「玻璃」选项
4. 验证浅色模式下导航栏、卡片、按钮呈现液态玻璃效果
5. 切换到深色模式，验证光晕效果更明显
6. hover 卡片验证发光边框和缩放效果
7. 点击文章打开详情面板，验证左侧光晕条效果

- [ ] **Step 3: 验证主题切换持久化**

1. 刷新页面，确认玻璃主题保持
2. 切换到其他主题再切回玻璃，确认正常工作

- [ ] **Step 4: 停止开发服务器**

- [ ] **Step 5: 创建最终提交**

```bash
git add -A
git commit -m "feat: macOS Tahoe 液态玻璃主题完成

新增 glass 配色方案，实现：
- 蓝紫冷色调配色（浅色/深色模式）
- 多层半透明液态玻璃效果
- 边缘光晕和内部高光折射
- 全面覆盖导航栏、卡片、按钮、弹窗、详情面板
- 与四季主题架构完全兼容"
```

---

## 计划自审

1. **Spec coverage:**
   - 配色方案变量 → Task 1, 2 ✅
   - 液态玻璃效果变量 → Task 1, 2 ✅
   - 导航栏样式覆盖 → Task 3 ✅
   - 文章卡片样式覆盖 → Task 3 ✅
   - 按钮样式覆盖 → Task 4 ✅
   - 详情面板样式覆盖 → Task 4 ✅
   - 弹窗/菜单样式覆盖 → Task 5 ✅
   - ThemeProvider 类型 → Task 6 ✅
   - TopNav 配色选项 → Task 7 ✅
   - 验证测试 → Task 8 ✅

2. **Placeholder scan:** 无 TBD/TODO，所有代码完整 ✅

3. **Type consistency:** ColorScheme 类型在 Task 6 定义，TopNav 使用一致 ✅