# 文章详情页图片查看功能实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为文章详情页正文图片添加点击放大查看功能，支持桌面端和移动端双端使用。

**Architecture:** 使用 react-medium-image-zoom 库包裹 react-markdown 渲染的 img 元素，在两个详情面板组件中添加自定义 components 配置，并在 globals.css 中添加样式覆盖以适配项目色彩系统。

**Tech Stack:** react-medium-image-zoom、react-markdown、Next.js、Tailwind CSS

---

## 文件结构

| 文件 | 操作 | 责任 |
|---|---|---|
| `apps/web/package.json` | 修改 | 添加 react-medium-image-zoom 依赖 |
| `apps/web/src/components/article/ArticleDetailPanel.tsx` | 修改 | 自定义 img 组件渲染，添加 Zoom 包裹 |
| `apps/web/src/components/article/WechatDetailPanel.tsx` | 修改 | 自定义 img 组件渲染，添加 Zoom 包裹 |
| `apps/web/src/app/globals.css` | 修改 | 添加图片查看器样式覆盖 |

---

### Task 1: 安装依赖

**Files:**
- Modify: `apps/web/package.json`

- [ ] **Step 1: 安装 react-medium-image-zoom**

Run: `cd /Users/dickies/Documents/workspaces/storing/apps/web && pnpm add react-medium-image-zoom`
Expected: 依赖安装成功，package.json 中出现 `"react-medium-image-zoom": "^x.x.x"`

- [ ] **Step 2: 验证安装**

Run: `pnpm list react-medium-image-zoom --filter web`
Expected: 显示已安装的版本号

---

### Task 2: 修改 ArticleDetailPanel 组件

**Files:**
- Modify: `apps/web/src/components/article/ArticleDetailPanel.tsx:12-13,98-101`

- [ ] **Step 1: 添加导入语句**

在文件顶部第 12-13 行附近添加导入：

```tsx
import Zoom from 'react-medium-image-zoom'
import 'react-medium-image-zoom/dist/styles.css'
```

位置：在 `import ReactMarkdown from 'react-markdown';` 之后添加。

- [ ] **Step 2: 修改 memoizedContent 渲染逻辑**

将第 98-101 行的 memoizedContent 修改为：

```tsx
const memoizedContent = useMemo(() => {
  if (!article?.contentMd) return null;
  return (
    <ReactMarkdown
      components={{
        img: ({ src, alt }) => (
          <Zoom>
            <img src={src} alt={alt} />
          </Zoom>
        ),
      }}
    >
      {article.contentMd}
    </ReactMarkdown>
  );
}, [article?.contentMd]);
```

---

### Task 3: 修改 WechatDetailPanel 组件

**Files:**
- Modify: `apps/web/src/components/article/WechatDetailPanel.tsx:13,59-62`

- [ ] **Step 1: 添加导入语句**

在文件顶部第 13 行附近添加导入：

```tsx
import Zoom from 'react-medium-image-zoom'
import 'react-medium-image-zoom/dist/styles.css'
```

位置：在 `import ReactMarkdown from 'react-markdown';` 之后添加。

- [ ] **Step 2: 修改 memoizedContent 渲染逻辑**

将第 59-62 行的 memoizedContent 修改为：

```tsx
const memoizedContent = useMemo(() => {
  if (!article?.contentMd) return null;
  return (
    <ReactMarkdown
      components={{
        img: ({ src, alt }) => (
          <Zoom>
            <img src={src} alt={alt} />
          </Zoom>
        ),
      }}
    >
      {article.contentMd}
    </ReactMarkdown>
  );
}, [article?.contentMd]);
```

---

### Task 4: 添加样式覆盖

**Files:**
- Modify: `apps/web/src/app/globals.css:284`（在 `.article-body pre code` 样式之后）

- [ ] **Step 1: 添加图片查看器样式**

在 `globals.css` 文件末尾（约第 1480 行之后）添加以下样式：

```css
/* ===== 图片查看器样式 ===== */

/* 图片查看器背景 */
[data-color-scheme='default'] .react-medium-image-zoom-overlay,
[data-color-scheme='wechat'] .react-medium-image-zoom-overlay,
:root .react-medium-image-zoom-overlay {
  background-color: oklch(0.15 0 0 / 0.9);
}

/* 查看器图片样式 */
.react-medium-image-zoom-zoomed {
  border-radius: var(--radius);
}

/* 玻璃主题适配 */
[data-color-scheme='glass'] .react-medium-image-zoom-overlay {
  background-color: oklch(18% 0.020 280 / 0.92);
}

/* 春季主题适配 */
[data-color-scheme='spring'] .react-medium-image-zoom-overlay {
  background-color: oklch(20% 0.020 145 / 0.9);
}

/* 夏季主题适配 */
[data-color-scheme='summer'] .react-medium-image-zoom-overlay {
  background-color: oklch(18% 0.025 230 / 0.9);
}

/* 秋季主题适配 */
[data-color-scheme='autumn'] .react-medium-image-zoom-overlay {
  background-color: oklch(22% 0.022 60 / 0.9);
}

/* 冬季主题适配 */
[data-color-scheme='winter'] .react-medium-image-zoom-overlay {
  background-color: oklch(16% 0.012 250 / 0.9);
}
```

---

### Task 5: 提交变更

**Files:**
- All modified files

- [ ] **Step 1: 检查变更**

Run: `git status`
Expected: 显示 4 个已修改文件

- [ ] **Step 2: 提交代码**

```bash
git add apps/web/package.json apps/web/pnpm-lock.yaml apps/web/src/components/article/ArticleDetailPanel.tsx apps/web/src/components/article/WechatDetailPanel.tsx apps/web/src/app/globals.css
git commit -m "$(cat <<'EOF'
feat: 添加文章详情页图片点击放大查看功能

- 引入 react-medium-image-zoom 库
- 修改 ArticleDetailPanel 和 WechatDetailPanel 的 img 渲染
- 添加多主题样式覆盖以适配项目色彩系统
EOF
)"
```

---

### Task 6: 验证功能

**Files:**
- None (manual verification)

- [ ] **Step 1: 启动开发服务器**

Run: `cd /Users/dickies/Documents/workspaces/storing && pnpm dev`
Expected: 前端启动在 http://localhost:1050，API 启动在 http://localhost:1052

- [ ] **Step 2: 验证桌面端功能**

在浏览器中：
1. 打开文章详情页
2. 点击正文中的图片，确认图片放大弹出
3. 点击背景或再次点击图片，确认关闭
4. 使用滚轮缩放，确认功能正常
5. 按 ESC 键，确认关闭查看器

- [ ] **Step 3: 验证移动端功能**

在移动端模拟器或真机中：
1. 打开文章详情页
2. 点击正文中的图片，确认图片放大弹出
3. 双指捏合缩放，确认功能正常
4. 单指拖动，确认功能正常
5. 点击背景关闭

- [ ] **Step 4: 验证样式**

检查图片查看器背景色与当前主题配色是否协调（深色半透明背景）。