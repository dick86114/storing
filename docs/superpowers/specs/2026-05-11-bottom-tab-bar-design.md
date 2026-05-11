# 移动端底部 Tab 栏设计

## 概述

为移动端添加 iOS 原生风格的底部 Tab 栏，替代现有顶部 TabsBar，提升移动端导航体验。

## 设计目标

1. iOS 原生风格：SF Symbols 图标 + 56px 固定高度 + 半透明背景
2. 与水平滑动容器联动，实时同步活动状态
3. 游客模式下完全隐藏（游客只能查看归档页面）
4. 与玻璃主题视觉适配

## 组件结构

```
apps/web/src/components/layout/
├── TabsBar.tsx         # 现有顶部 tab（桌面端继续使用）
├── BottomTabBar.tsx    # 新增底部 tab（移动端专用）
└── TabIcons.tsx        # SVG 图标组件（SF Symbols 风格）
```

在 `layout.tsx` 中响应式显示：
- 移动端（< 640px）：隐藏 TabsBar，显示 BottomTabBar
- 桌面端（≥ 640px）：显示 TabsBar，隐藏 BottomTabBar

## 样式设计

### BottomTabBar 容器

| 属性 | 值 | 说明 |
|------|-----|------|
| position | `fixed` | 固定在底部 |
| bottom | `0` | 紧贴底部 |
| width | `100vw` | 全屏宽度 |
| height | `56px` | iOS 标准 tab bar 高度 |
| display | `flex` | 水平排列 |
| justify-content | `space-around` | 均匀分布 |
| background | `var(--glass)` | 半透明背景 |
| backdrop-filter | `blur(20px) saturate(1.4)` | 玻璃模糊效果 |
| border-top | `1px solid var(--glass-border)` | 上边缘细线 |
| z-index | `50` | 位于内容之上 |

### 单个 Tab 项

| 属性 | 值 | 说明 |
|------|-----|------|
| flex | `1` | 均分宽度 |
| display | `flex` | 垂直布局 |
| flex-direction | `column` | 图标在上，文字在下 |
| align-items | `center` | 居中对齐 |
| justify-content | `center` | 居中对齐 |
| padding | `8px 0` | 上下间距 |

**活动状态样式：**
- 图标颜色：`var(--accent)`
- 文字颜色：`var(--accent)`
- 文字粗细：`500`

**非活动状态样式：**
- 图标颜色：`var(--muted)`
- 文字颜色：`var(--muted)`
- 文字粗细：`400`

### 图标设计（SF Symbols 风格）

| Tab | 图标名称 | SVG 设计 |
|------|----------|----------|
| 收件箱 | tray | 底部托盘形状，上方有两条横线表示内容 |
| 收藏 | heart | 心形轮廓，iOS 系统风格 |
| 归档 | archivebox | 箱子形状，顶部有盖板 |

图标尺寸：24px × 24px
线条粗细：1.5px

### 文字标签

- 字体：`var(--font-body)`
- 字号：`11px`
- 行高：`1.2`

### 数字徽章

- 位置：图标右上角，`absolute` 定位
- 尺寸：`6px` 圆点或 `12px × 12px` 小圆圈
- 背景：`var(--accent)`
- 颜色：`white`
- 圆角：`999px`

## 交互行为

### 点击切换

- 点击 Tab → 切换到对应页面
- URL 同步更新（`/inbox`、`/favorites`、`/archive`）
- 水平滑动动画（利用现有 HorizontalScrollContainer）

### 滑动联动

- 用户水平滑动页面时，底部 Tab 的活动状态实时跟随
- 接收 `scrollProgress` 参数（0~2），计算当前活动索引
- 图标颜色平滑过渡（无跳变）

### 游客模式

- 游客状态下 BottomTabBar 完全隐藏
- 游客只能查看归档页面，无需导航

### 玻璃主题适配

```css
[data-color-scheme='glass'] .bottom-tab-bar {
  background: color-mix(in oklch, var(--surface) 85%, transparent);
  border-top: 1px solid var(--glass-border-glow);
}
```

## 实现范围

### 文件修改

| 文件 | 操作 | 说明 |
|------|------|------|
| `components/layout/BottomTabBar.tsx` | 新建 | 底部 Tab 栏组件 |
| `components/layout/TabIcons.tsx` | 新建 | SVG 图标组件 |
| `app/(main)/layout.tsx` | 修改 | 响应式显示 BottomTabBar/TabsBar |
| `components/layout/HorizontalScrollContainer.tsx` | 修改 | 传递 scrollProgress 给 BottomTabBar |
| `app/globals.css` | 修改 | 添加底部 Tab 栏样式覆盖 |

### 响应式断点

- 移动端：< 640px（显示 BottomTabBar）
- 桌面端：≥ 640px（显示 TabsBar）

## 设计自审

- 无 TBD 或 TODO 项
- 组件结构、样式、交互行为完整定义
- 游客模式行为明确（完全隐藏）
- 玻璃主题适配已考虑
- 实现范围清晰，单个实现计划可覆盖