# 文章详情页图片查看功能设计

## 概述

为文章详情页的正文图片添加点击放大查看功能，支持桌面端和移动端双端使用。

## 技术选型

**库**：`react-medium-image-zoom`

| 特性 | 说明 |
|---|---|
| 体积 | ~15KB，轻量 |
| 移动端支持 | 原生支持 pinch-to-zoom、单指拖动 |
| 动画 | CSS transform，流畅 |
| API | 简单，只需包裹 `<img>` 元素 |

## 实现位置

修改两个详情面板组件中的 `react-markdown` 渲染逻辑：

- `apps/web/src/components/article/ArticleDetailPanel.tsx`（桌面端）
- `apps/web/src/components/article/WechatDetailPanel.tsx`（微信风格）

## 代码改动

### 1. 安装依赖

```bash
pnpm add react-medium-image-zoom
```

### 2. 导入和配置

```tsx
import Zoom from 'react-medium-image-zoom'
import 'react-medium-image-zoom/dist/styles.css'
```

### 3. 自定义 img 组件

在 `react-markdown` 的 `components` prop 中替换默认 `img` 渲染：

```tsx
components={{
  img: ({ src, alt }) => (
    <Zoom>
      <img src={src} alt={alt} />
    </Zoom>
  )
}}
```

## 样式适配

### 基础样式

保留 `globals.css` 中现有的 `.article-body img` 样式：
- 圆角 (`border-radius: var(--radius)`)
- margin 和响应式尺寸

### 自定义覆盖

添加以下 CSS 以适配项目的 oklch 色彩系统：

```css
/* 图片查看器背景 */
.react-medium-image-zoom-overlay {
  background-color: oklch(0.15 0 0 / 0.9);
}

/* 查看器图片样式 */
.react-medium-image-zoom-zoomed {
  border-radius: var(--radius);
}
```

## 交互行为

### 桌面端

| 操作 | 行为 |
|---|---|
| 点击图片 | 放大到全屏 |
| 再次点击 | 缩小回原位 |
| 滚轮 | 放大状态下缩放 |
| 鼠标拖动 | 放大状态下移动图片 |
| ESC 键 | 关闭查看器 |
| 点击背景 | 关闭查看器 |

### 移动端

| 操作 | 行为 |
|---|---|
| 点击图片 | 放大到全屏 |
| 再次点击 | 缩小回原位 |
| 双指捏合 | 放大状态下缩放 |
| 单指拖动 | 放大状态下移动图片 |
| 点击背景 | 关闭查看器 |

## 边界情况

- **图片加载失败**：保持原有行为，不触发查看器
- **SVG 图片**：库支持，正常处理
- **GIF 图片**：放大后保持动画播放
- **超大图片**：放大后有边界限制，防止拖出可视区域

## 测试验证

1. 桌面端浏览器测试点击、缩放、拖动、ESC 关闭
2. 移动端测试双指缩放、单指拖动、背景点击关闭
3. 验证样式与项目色彩系统一致
4. 验证不影响现有 markdown 渲染（链接、代码块等）

## 文件变更清单

| 文件 | 操作 |
|---|---|
| `apps/web/package.json` | 添加 react-medium-image-zoom 依赖 |
| `apps/web/src/components/article/ArticleDetailPanel.tsx` | 修改 img 组件渲染 |
| `apps/web/src/components/article/WechatDetailPanel.tsx` | 修改 img 组件渲染 |
| `apps/web/src/app/globals.css` | 添加查看器样式覆盖 |