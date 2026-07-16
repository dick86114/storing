# 私有知识库与公开发布设计

**日期：** 2026-07-16  
**状态：** 已确认，待实现  
**适用项目：** Storing（乾坤戒）

## 1. 背景与目标

Storing 当前的原文缓存可由多个用户复用，但用户的收件箱、收藏、归档、AI 摘要和标签都属于用户自己的业务状态。此前的用户作用域改造已让 `article_metadata` 关联 `user_id`，但归档、Wiki、公开访问、分享链接尚未完全收敛为一致的权限模型。

本改造目标：

1. 每名用户只能访问自己收录、收藏、归档的文章和自己的 Wiki。
2. 增加“发布”状态。发布是用户级状态，而非原文的全局状态。
3. 游客只能访问公开发布流与公开文章详情，不能访问任何私有文章或 Wiki。
4. 任何用户都可以从收件箱、收藏、归档发起发布；未归档时系统先完成归档与 AI 内容生成，再发布。
5. 分享始终使用发布后的公开链接，绝不泄漏私有文章链接。

## 2. 方案选择

### 方案 A：用户元数据承载发布状态与公开 Token（采用）

将发布状态继续保存于 `article_metadata`，每条“用户—文章”关系拥有自己的：

- `is_published`
- `published_at`
- `public_id`

`public_id` 是不可预测、全局唯一的随机 UUID/Token。公开详情由 `public_id` 定位用户元数据，而不是仅以全局 `article_id` 定位。

**原因：** 用户的归档、正文快照、摘要、分类、标签已经保存在 `article_metadata`。这一方案保持一个用户状态写入点，并自然支持不同用户发布同一原文而展示不同的 AI 内容。

### 方案 B：独立 `publications` 表（不采用）

适合未来需要发布版本、审核、评论、订阅、统计等独立内容平台能力。当前只需要一篇用户文章对应一份可撤销的公开发布，额外表会引入双写和状态同步成本。

### 方案 C：在全局 `articles` 表上发布（不采用）

全局发布会让一位用户的操作影响其他用户，也无法可靠关联发布者自己的摘要、标签和正文版本，不符合私有知识库要求。

## 3. 数据模型

### 3.1 文章元数据

继续以 `(article_id, user_id)` 作为一条用户文章元数据的身份边界，并增加：

```ts
isPublished: boolean('is_published').notNull().default(false)
publishedAt: timestamp('published_at')
publicId: text('public_id').unique()
```

约束：

- `is_published = true` 时必须存在 `public_id` 与 `published_at`。
- `is_published = false` 时保留 `public_id`，以便后续重新发布使用同一稳定链接；公开查询必须同时要求 `is_published = true`。
- 允许多个用户对同一个 `article_id` 各自拥有独立的 `public_id`。

### 3.2 Wiki 作用域

所有 Wiki 派生记录必须关联 `user_id`；用户间不可共享 Wiki 页、关系、索引、抽取或日志。

需要调整的实体包括：

- `wiki_articles`
- `wiki_article_extracts`
- `wiki_pages`
- `wiki_page_sources`
- `wiki_source_chunks`
- `wiki_claims`
- `wiki_relationships`
- `wiki_jobs`
- `wiki_log_entries`

关键唯一约束：

- `wiki_articles`：`(user_id, article_id)` 唯一；替代现有仅 `article_id` 唯一。
- `wiki_article_extracts`：`(user_id, article_id)` 唯一。
- `wiki_pages`：`(user_id, slug)` 唯一；不再要求 slug 全局唯一。

旧的全局 Wiki 派生记录不再作为读路径来源。迁移后根据每名用户已归档文章重建 Wiki；原始文章和用户归档数据不会丢失。

## 4. 权限与访问模型

| 资源 | 已登录用户 | 游客 |
| --- | --- | --- |
| 收件箱 | 仅本人 | 禁止 |
| 收藏 | 仅本人 | 禁止 |
| 归档 | 仅本人 | 禁止 |
| Wiki（列表、页、搜索、图谱、任务、日志） | 仅本人 | 禁止 |
| 发布管理 Tab | 仅本人发布的文章 | 不显示管理能力 |
| 公开发布流 `/published` | 可选公开浏览；不会混入私有管理查询 | 允许，仅已发布内容 |
| 公开详情 `/p/:publicId` | 允许 | 允许，仅已发布内容 |

认证后的私有查询必须始终以当前 JWT 用户的 `user_id` 联结或筛选。不得用全局 `article_id` 单独查询 `article_metadata`、Wiki 数据或任何派生内容。

## 5. 发布与取消发布流程

### 5.1 发布

接口：`POST /articles/:id/publish`

1. 读取当前认证用户的文章元数据；不存在返回 404。
2. 若文章未归档，执行现有归档准备：正文抓取/修复、封面处理、AI 摘要、分类与标签生成。
3. 归档准备成功后，写入：
   - `is_archived = true`
   - `archived_at`（首次归档时）
   - `is_published = true`
   - `published_at = now()`（首次发布或重新发布时）
   - `public_id`（仅首次生成）
4. 将文章提交至该用户的 Wiki 编译队列。
5. 返回当前公开链接和完整发布状态。

发布接口必须幂等：已发布文章再次调用不会生成新链接，也不会重复执行昂贵的 AI 生成。

若归档准备或 AI 生成失败，接口返回失败且不得设置 `is_published = true`。已经成功写入的归档内容可保留为私有归档，公开状态不开放。

### 5.2 取消发布

接口：`POST /articles/:id/unpublish`

- 仅将 `is_published` 置为 `false`。
- 保留归档、摘要、分类、标签、正文与 Wiki 数据。
- `/published` 与 `/p/:publicId` 立即不再返回该文章。
- 重新发布复用同一 `public_id`。

## 6. 公开查询与 URL

### 6.1 公开发布流

接口：`GET /articles?view=published`

- 游客：只返回 `is_published = true` 的公开投影。
- 已登录用户的私有“发布管理”Tab：增加显式 `scope=mine` 或等价内部查询，仅返回当前用户自己的发布记录。
- 公开投影只包含展示所需字段；不返回用户私有来源、客户端信息、管理状态或未发布版本数据。

### 6.2 公开详情

接口：`GET /publications/:publicId`，或等价的公开读取端点。

- 查询条件为 `article_metadata.public_id = :publicId AND is_published = true`。
- 响应使用该条用户元数据的正文、封面、AI 摘要、分类和标签。
- 禁止通过旧的 `/articles/:id` 暴露“只要任意用户发布过即可访问”的模糊逻辑。
- Web 公开页路径为 `/p/:publicId`。

## 7. 分享行为

文章详情和列表内的分享动作统一执行：

1. 调用 `POST /articles/:id/publish`。
2. 成功后使用返回的 `/p/:publicId` 作为剪贴板与系统分享 URL。
3. 已发布文章直接复用其公开链接。
4. 发布失败时显示失败原因，不复制或展示任何私有文章 URL。

## 8. 前端改动

1. 新增“发布”Tab 和对应页面/内容组件。
2. 在收件箱、收藏、归档文章菜单及详情操作区增加发布/取消发布。
3. 分享按钮改为“确保发布后分享”，展示加载状态以避免重复点击。
4. 游客 UI 只保留发布流入口及登录入口；隐藏收件箱、收藏、归档、Wiki、管理菜单。
5. 新增公开详情页 `/p/[publicId]`；页面不依赖私有认证上下文。
6. 发布文章卡片和详情明确展示摘要、分类、标签与发布时间。

## 9. 数据迁移与兼容性

1. 增加 `public_id` 列和唯一索引；为已有已发布记录回填随机 Token。
2. 保留已有 `is_published`、`published_at` 兼容已有工作区改动。
3. 为 Wiki 表增加 `user_id`，替换涉及全局 `article_id` 或 `slug` 的唯一约束。
4. 对能从 `(article_id, user_id)` 明确推断归属的旧 Wiki 数据进行回填；无法安全归属的派生数据不对外读取，按用户已归档文章重建。
5. 所有迁移采用可重复执行的 schema-guard/索引检查，遵循现有 `metadata-scope.service.ts` 的兼容性模式。

## 10. 验收标准

1. 用户 A 无法通过列表、详情、计数、搜索、来源、位置或 Wiki 任一接口读取用户 B 的私有数据。
2. 游客访问收件箱、收藏、归档、Wiki 和私有文章详情被拒绝；只能访问 `/published` 和已发布的 `/p/:publicId`。
3. 未归档文章发布后自动变为已归档、已发布，并且公开页包含 AI 摘要、分类、标签和文章正文。
4. 发布已归档文章不会重复生成 AI 内容；重复发布保持同一公开链接。
5. 分享未发布文章会先发布，成功后只分享 `/p/:publicId`。
6. 用户 A 与用户 B 发布同一原文时，公开链接不同，且公开内容取各自的用户元数据。
7. 取消发布使公开流与公开详情立即不可访问，同时保留用户归档和 Wiki 数据。
8. API 构建、针对性测试及本地真实浏览器流程均通过。
