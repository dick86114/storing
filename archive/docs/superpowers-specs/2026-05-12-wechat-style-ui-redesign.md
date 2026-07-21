---
name: 微信风格UI重构
description: 全站UI/UX重构，参考微信设计风格，包括移动端滑动Tab、底部导航栏、文章列表、详情页、桌面端布局等
type: project
---

# 微信风格 UI/UX 重构设计方案

## 设计背景

当前项目的移动端滑动Tab切换功能存在多个问题：
- 滑动灵敏度不稳定
- Tab激活状态同步异常
- 滑动后吸附位置不准确

同时整体UI风格不够统一，需要全面重构。用户要求参考微信的设计风格，重新打造一套完整的UI/UX体系。

## 设计目标

1. **移动端滑动Tab切换**：采用更稳定的手势识别方案，解决当前问题
2. **底部Tab栏**：参考微信底部导航栏设计（占满宽度、高度56px、图标+文字）
3. **文章列表**：参考微信公众号图文排版（标题+三点菜单 → 封面图 → 作者+时间）
4. **文章详情页**：参考微信公众号文章详情页布局
5. **顶部导航**：右侧下拉菜单堆放（搜索、添加、设置），中间Logo+标题
6. **整体风格**：参考微信配色、图标、字体等元素

---

## 一、配色方案

### 浅色模式

| 元素 | 颜色值 | 说明 |
|------|--------|------|
| 主背景 | `#ededed` | 微信灰色背景 |
| 卡片背景 | `#fff` | 白色卡片 |
| 导航栏背景 | `#f7f7f7` | 浅灰导航 |
| 主文字 | `#000` / `#191919` | 黑色主文字 |
| 次文字 | `#888` | 灰色次要文字 |
| 激活色 | `#07c160` | 微信绿 |
| 分割线 | `#d6d6d6` / `#e5e5e5` | 浅灰分割线 |
| 标签背景 | `#f5f5f5` | 标签浅灰背景 |

### 深色模式

| 元素 | 颜色值 | 说明 |
|------|--------|------|
| 主背景 | `#1f1f1f` | 深灰背景（非纯黑） |
| 卡片背景 | `#2c2c2c` | 深灰卡片 |
| 导航栏背景 | `#2c2c2c` | 深灰导航 |
| 主文字 | `#fff` | 白色主文字 |
| 次文字 | `#b2b2b2` / `#888` | 浅灰次要文字 |
| 激活色 | `#07c160` | 微信绿（保持不变） |
| 分割线 | `#3a3a3a` | 深灰分割线 |
| 标签背景 | `#3a3a3a` | 标签深灰背景 |

---

## 二、图标规范

### 图标来源

全部采用 **Ant Design Icons** 线条风格图标。

### 图标属性

| 属性 | 值 | 说明 |
|------|-----|------|
| 线宽 | `stroke-width: 2` | 统一线条粗细 |
| 端点 | `stroke-linecap: round` | 圆角端点 |
| 连接 | `stroke-linejoin: round` | 圆角连接 |
| 尺寸 | 20-24px | 根据场景调整 |

### Tab图标

| Tab | 图标 | 激活状态 |
|-----|------|----------|
| 收件箱 | AppstoreOutlined / 四格方块 | fill 填充 + 微信绿 |
| 收藏 | HeartOutlined / 网络心形 | stroke 线条 + 微信绿fill |
| 归档 | FolderOutlined / 文件夹 | stroke 线条 + 微信绿fill |

### 操作图标

| 操作 | 图标 |
|------|------|
| 搜索 | SearchOutlined |
| 添加 | PlusOutlined |
| 三点菜单 | MoreOutlined（横向三点） |
| 返回 | LeftOutlined |
| 分享 | ShareAltOutlined |
| 收藏 | HeartOutlined |
| 归档 | FolderOutlined |
| 阅读原文 | LinkOutlined |

---

## 三、字体规范

### 标题字体

- **品牌名**：Storing
- **字体**：Brush Script MT / cursive 书写体
- **字号**：18-20px
- **配合**：Logo圆圈图标（28px，内含字母"S"）

### 正文字体

| 元素 | 字号 | 字重 | 行高 |
|------|------|------|------|
| 文章标题（列表） | 17px | 500 | 1.4 |
| 文章标题（详情） | 20px | 500 | 1.5 |
| 文章正文 | 17px | 400 | 1.8 |
| 作者/时间 | 12px | 400 | 1.0 |
| 来源信息（详情） | 14px | 400 | 1.0 |
| Tab文字 | 10px | 400-500 | 1.0 |
| 标签 | 12px | 400 | 1.0 |

---

## 四、移动端设计

### 4.1 顶部导航

**布局结构：**
```
[空白占位] ---- [Logo + Storing] ---- [搜索图标] [+图标]
```

**样式属性：**
- 高度：44px
- 背景：#ededed（浅色）/ #1f1f1f（深色）
- 左侧：空白占位44px
- 中间：Logo(28px圆圈) + Storing(书写体20px)
- 右侧：搜索图标(22px) + +图标(22px)，间距12px

**+号下拉菜单内容：**
- 搜索
- 添加文章
- 设置/主题切换

### 4.2 底部Tab栏

**布局结构：**
- 占满屏幕宽度
- 高度：56px + safe-area-inset-bottom
- 无胶囊背景，无边框分割线
- 图标在上(24px)，文字在下(10px)

**样式属性：**
- 背景：#f7f7f7（浅色）/ #2c2c2c（深色）
- 顶部边框：0.5px solid #d6d6d9（浅色）/ #3a3a3a（深色）
- 激活状态：图标fill + 微信绿(#07c160)，文字微信绿
- 未激活状态：图标stroke + #191919（浅色）/ #b2b2b2（深色），文字灰色

### 4.3 滑动Tab切换方案

**实现方案：手势识别 + CSS scroll-snap**

放弃当前基于scroll事件监听的复杂方案，采用：

1. **CSS scroll-snap**：使用 `scroll-snap-type: x mandatory` 实现自动吸附
2. **touch事件**：监听 touchstart/touchend 识别swipe手势方向
3. **路由同步**：只在吸附完成后更新URL，避免中间状态混乱

**核心代码结构：**
```css
.container {
  display: flex;
  overflow-x: auto;
  scroll-snap-type: x mandatory;
  scroll-behavior: smooth;
}

.page {
  width: 100vw;
  scroll-snap-align: start;
  scroll-snap-stop: always;
}
```

**手势判断逻辑：**
- touchstart 记录起始位置
- touchend 计算滑动距离和方向
- 滑动距离 > 50px 且方向明确 → 切换到相邻Tab
- 否则 → 保持当前Tab

**Why:** 当前方案用scroll事件+setTimeout判断滚动结束，状态源过多（activeIndex、scrollProgress、isScrolling）导致同步问题。scroll-snap由浏览器原生处理吸附，稳定可靠。

**How to apply:** 新建 `SwipeableContainer` 组件替代 `HorizontalScrollContainer`，移除所有scroll事件监听和手动吸附逻辑。

### 4.4 文章卡片（列表页）

**布局顺序：**
```
第一行：标题 + 三点菜单（横向）
第二行：封面图
第三行：作者名 · 发布时间（左右分布）
```

**样式属性：**
- 卡片背景：#fff（浅色）/ #2c2c2c（深色）
- 卡片间距：8px #ededed间隙（浅色）/ 8px #1f1f1f间隙（深色）
- 圆角：4px
- 内边距：12px 16px

**三点菜单：**
- 图标：MoreOutlined（横向三点）
- 尺寸：18-20px
- 点击弹出：收藏、归档选项

### 4.5 文章详情页

**顶部导航：**
```
[返回箭头] ---- [空白] ---- [三点菜单（横向）]
```
- 高度：44px
- 返回：LeftOutlined箭头(22px)，无文字
- 三点：MoreOutlined横向(22px)

**文章头部布局：**
```
第一行：文章标题（20px，500字重）
第二行：来源 · 作者 · 发布时间（14px，灰色）
第三行：AI标签（如有）
```

**AI摘要卡片：**
- 背景：#f8f8f8（浅色）/ #2c2c2c（深色）
- 圆角：8px
- 内边距：14px
- 间距：与正文间距8px
- 标题：绿色AI图标 + "智能摘要"

**底部操作栏：**
```
[阅读原文(绿色)] ---- ---- [归档] [分享] [收藏]
```
- 左侧：LinkOutlined(18px) + "阅读原文"(14px)，微信绿
- 右侧：三个按钮，icon(20px)在上，文字(11px)在下
- 背景：#f7f7f7（浅色）/ #2c2c2c（深色）
- 位置：sticky固定底部

---

## 五、桌面端设计

### 5.1 顶部导航

**布局结构：**
```
[Logo + Storing] ---- [搜索框] ---- [用户下拉] [主题图标]
```

**样式属性：**
- 高度：56px
- Logo：32px方型圆角6px
- 搜索框：宽度300px，圆角8px，白色/深灰背景
- 用户下拉：用户图标 + "admin" + 下拉箭头
- 主题图标：太阳/月亮图标切换

### 5.2 Tabs导航

**布局结构：**
- 顶部固定，背景白色/深灰
- 图标(18px) + 文字(14px) + 数字badge
- 激活状态：底部2px微信绿指示线

**样式属性：**
- 背景：#fff（浅色）/ #2c2c2c（深色）
- 激活Tab：图标fill + 微信绿，文字微信绿
- 未激活Tab：图标stroke + #191919，文字灰色
- badge：浅灰背景，圆角10px，字号12px

### 5.3 文章卡片

**桌面端卡片布局（封面图在上）：**
```
封面图（140px高度）
↓
标题 + 三点菜单（横向）
↓
作者 · 时间
```

**样式属性：**
- 卡片背景：#fff（浅色）/ #2c2c2c（深色）
- 圆角：8px
- 内边距：12px
- 封面图：高度140px，宽度100%，object-fit: cover
- 紧凑布局，无大片空白

### 5.4 响应式卡片布局

**使用CSS Grid auto-fill实现自动填充：**

```css
.article-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}
```

**效果：**
- 自动根据容器宽度计算卡片数量
- 最小卡片宽度280px，自动扩展填充剩余空间
- 无空白区域，紧凑排列

### 5.5 桌面端文章详情页展示

**展示方式：右侧滑出面板**

点击文章后，详情页以侧边面板形式展示：

- **面板宽度**：420px固定
- **左侧效果**：列表区域半透明遮罩(opacity: 0.3) + 模糊效果(filter: blur(2px))
- **面板位置**：右侧固定，覆盖在列表上方
- **交互**：点击遮罩或返回按钮关闭面板

**详情面板内容：**
- 顶部导航：返回箭头 + 三点菜单（与移动端一致）
- 文章头部：标题(20px) → 来源·作者·时间(14px) → 标签
- AI摘要卡片：独立背景卡片
- 正文：字号16px（稍小以适应面板宽度）
- 底部操作栏：阅读原文 + 归档/分享/收藏（sticky固定）

---

## 六、归档页设计

### 6.1 移动端归档页

**分类筛选（药丸式按钮）：**

- 横向滚动的药丸按钮
- 圆角：999px（完全圆角）
- 激活状态：分类色背景 + 边框
- 未激活状态：透明背景 + 边框

**样式属性：**
- 背景：#fff
- 内边距：6px 14px
- 字号：12px
- 间距：8px

### 6.2 桌面端归档页

**布局结构：左侧分类侧边栏 + 右侧文章网格**

**分类侧边栏：**
- 宽度：240px（加宽避免文字换行）
- 背景：#fff，圆角8px
- 分类项：带颜色圆点标识 + 分类名 + 数量
- 激活状态：微信绿背景高亮

**分类颜色：**
- **动态生成**：AI智能分类，不固定颜色
- 每个分类自动分配一个颜色（从预设色板中选取）
- 使用6px圆点标识颜色

**响应式卡片网格：**
- 与其他页面一致，使用CSS Grid auto-fill
- 最小宽度280px，自动填充

---

## 七、组件改造清单

### 需要新建的组件

| 组件 | 文件 | 说明 |
|------|------|------|
| SwipeableContainer | `SwipeableContainer.tsx` | 替代HorizontalScrollContainer，scroll-snap实现 |
| WechatTopNav | `WechatTopNav.tsx` | 微信风格顶部导航 |
| WechatBottomTab | `WechatBottomTab.tsx` | 微信风格底部Tab栏 |
| WechatArticleCard | `WechatArticleCard.tsx` | 微信风格文章卡片 |
| WechatDetailHeader | `WechatDetailHeader.tsx` | 详情页顶部导航 |
| WechatDetailFooter | `WechatDetailFooter.tsx` | 详情页底部操作栏 |

### 需要修改的组件

| 组件 | 文件 | 改动 |
|------|------|------|
| ArticleDetailPanel | `ArticleDetailPanel.tsx` | 重构布局和样式 |
| ArticleList | `ArticleList.tsx` | 使用WechatArticleCard |
| TabsBar | `TabsBar.tsx` | 桌面端样式重构 |
| TopNav | `TopNav.tsx` | 桌面端样式重构 |
| layout.tsx | `(main)/layout.tsx` | 整体布局重构 |

### 需要删除的组件

| 组件 | 文件 | 说明 |
|------|------|------|
| HorizontalScrollContainer | `HorizontalScrollContainer.tsx` | 用SwipeableContainer替代 |
| BottomTabBar | `BottomTabBar.tsx` | 用WechatBottomTab替代 |

---

## 八、CSS变量重构

更新全局CSS变量以匹配微信配色：

```css
/* 浅色模式 */
:root {
  --bg: #ededed;
  --card-bg: #fff;
  --nav-bg: #f7f7f7;
  --text: #000;
  --text-muted: #888;
  --accent: #07c160;
  --accent-soft: #e8f8e8;
  --border: #d6d6d6;
  --divider: #e5e5e5;
}

/* 深色模式 */
[data-theme="dark"] {
  --bg: #1f1f1f;
  --card-bg: #2c2c2c;
  --nav-bg: #2c2c2c;
  --text: #fff;
  --text-muted: #b2b2b2;
  --accent: #07c160;
  --accent-soft: #1a3a1a;
  --border: #3a3a3a;
  --divider: #3a3a3a;
}
```

---

## 九、实现优先级

按建议顺序推进：

1. **Phase 1：基础框架** - Tab切换、底部导航、顶部导航
2. **Phase 2：内容样式** - 文章卡片、详情页布局
3. **Phase 3：全局风格** - 配色变量、图标替换、字体调整

---

## 十、验收标准

1. 移动端滑动Tab切换流畅稳定，无灵敏度/同步/吸附问题
2. 底部Tab栏视觉与微信一致
3. 文章卡片布局符合微信公众号风格
4. 详情页阅读体验良好，操作栏布局正确
5. 深浅色模式切换正常，配色符合微信风格
6. 桌面端响应式布局合理，卡片网格自动填充无空白
7. 归档页分类筛选功能正常，侧边栏宽度充足
8. 桌面端详情页右侧面板展示正确，遮罩效果正常
9. 所有图标采用Ant Design风格，统一线条粗细