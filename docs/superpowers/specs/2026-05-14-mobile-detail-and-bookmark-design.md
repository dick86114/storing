# 移动端详情页优化 + 书签功能设计文档

## 背景

用户反馈两个问题：
1. 移动端详情页右边有很大空白，可以水平滑动过去
2. 希望能记住退出时正在阅读的文章，打开后继续阅读

## 需求

### 需求 1：移动端详情页空白修复

修复详情面板在移动端的布局问题，确保内容全宽填充且页面不可水平滚动。

### 需求 2：书签功能

用户可以手动在详情页打书签，记录当前文章及滚动位置。下次打开应用时提示是否继续阅读。

**特性：**
- 用户主动点击书签按钮创建书签
- 记录文章ID + 滚动位置
- 新书签覆盖旧书签（只保留一个）
- 打开应用时弹窗提示是否继续阅读
- 书签对所有用户有效（游客和登录用户共用同一个书签）

## 改动范围

### 需求 1：移动端详情页修复

**文件：** `apps/web/src/app/globals.css`

**改动内容：**

```css
/* overlay 层阻止水平滚动 */
.detail-panel-overlay {
  overflow-x: hidden;
}

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

### 需求 2：书签功能

**新增文件：**

- `apps/web/src/hooks/useBookmark.ts` - 书签状态管理 hook

**修改文件：**

- `apps/web/src/components/article/ArticleDetailPanel.tsx` - 添加底部悬浮书签按钮
- `apps/web/src/app/archive/page.tsx` - 添加书签检测和提示
- `apps/web/src/app/inbox/page.tsx` - 添加书签检测和提示
- `apps/web/src/app/favorites/page.tsx` - 添加书签检测和提示

## 数据结构

```typescript
interface ReadingBookmark {
  view: 'inbox' | 'archive' | 'favorites';
  articleId: number;
  scrollPosition: number;  // 滚动像素值
  articleTitle?: string;   // 用于提示显示
  timestamp: number;
}
```

**存储位置：** localStorage key `reading_bookmark`

统一存储，不区分登录状态。用户打的书签就是当前书签，登录前后都有效。

## UI 设计

### 书签按钮

- **位置：** 详情页底部操作区（与归档、收藏按钮同一行），最左边
- **样式：** 与其他操作按钮风格一致
- **行为：**
  - 点击保存当前书签（覆盖旧书签）
  - Toast 提示："已保存书签"
  - 滚动时实时更新按钮显示的滚动位置（可选）

### 打开应用提示

- **触发时机：** 页面加载完成，检测到有效书签
- **提示内容：** "检测到上次的书签（文章标题），是否继续阅读？"
- **按钮：** [继续阅读] [取消]
- **行为：**
  - 继续：切换到对应视图，打开详情页，滚动到记录位置
  - 取消：清除提示，不做任何跳转

## 异常处理

1. **书签文章不存在**
   - 检测文章是否在当前视图
   - 若不存在，提示"书签已失效"并清除书签

2. **书签文章不在当前视图**
   - 自动切换到正确视图（inbox/archive/favorites）

3. **文章列表未加载完成**
   - 等待加载完成后再尝试打开详情页

## 实现顺序

1. 修复移动端详情页空白问题（CSS）
2. 创建 useBookmark hook
3. 添加书签按钮到详情页底部
4. 在各视图页面添加书签检测和提示逻辑
5. 测试验证