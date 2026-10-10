# 文章批量操作设计

日期：2026-10-10

## 目标

为收件箱、收藏、归档和已发布列表提供统一的文章批量操作能力，让用户可以一次处理多篇收藏文章，并获得清晰的成功、跳过和失败反馈。首期以 Web 端完整落地，API 契约保持客户端中立，Android 和 macOS 后续复用。

## 范围

首期支持：

- 批量收藏
- 批量取消收藏
- 批量归档
- 批量取消归档
- 批量删除
- 批量彻底删除
- 批量设置分类
- 批量重新判断分类
- 批量生成 AI 摘要和标签
- 批量发布
- 批量取消发布
- 批量导出 ZIP
- 批量导出 Obsidian Markdown ZIP

第二阶段支持：

- Android 与 macOS 原生客户端批量入口
- ZIP 下载图片并归档到 `_resources`
- 自定义导出目录和 frontmatter 模板
- 按筛选条件选择全部匹配文章

明确不做：

- 直接写入用户的 Obsidian 保管库
- 第三方笔记应用云同步
- 不经过确认的直接物理删除

## 用户体验

列表工具栏新增“批量操作”入口。进入批量模式后：

- 卡片显示选择状态，点击卡片切换选择，点击普通操作按钮不再触发详情打开
- 工具栏显示已选数量
- 支持全选当前已加载文章、反选和退出
- 加载更多后保留已选 ID
- 筛选条件变化时提示选择会被清空
- 已选择文章在列表中被移除后自动从选择集中剔除

批量操作栏按场景收敛动作：

- 收件箱：收藏、归档、删除、生成 AI、发布、导出
- 收藏：取消收藏、归档、删除、生成 AI、发布、导出
- 归档：取消收藏、收藏、取消归档、删除、设置分类、重新判断分类、生成 AI、发布、取消发布、导出
- 已发布：取消发布、删除、导出

删除使用确认弹窗。彻底删除使用强确认，明确提示不可恢复，并说明共享原文只会在没有其他用户引用时删除。发布前提示会把未归档文章自动归档并生成公开链接。取消发布提示公开链接立即失效，但文章保留在归档中。

## 操作语义

### 收藏与归档

- `favorite` 将所选文章统一设为已收藏；已收藏的文章跳过
- `unfavorite` 将所选文章统一设为未收藏；未收藏的文章跳过
- `archive` 将所选文章统一归档；已归档的文章跳过
- `unarchive` 将所选文章移回收件箱；未归档的文章跳过
- 批量归档沿用单篇归档的分类、AI 触发和封面处理规则

### 删除

- 普通删除只更新当前用户 `article_metadata.is_deleted`
- 彻底删除沿用现有单篇逻辑：共享文章仍有其他用户引用时只删除当前用户元数据；没有引用时清理任务和审计外键后删除原始文章
- 彻底删除逐篇执行带行锁的事务，允许部分成功，避免并发引用计数竞态

### 分类与 AI

- 设置分类继续使用现有 `bulk-category` 语义，并纳入统一结果结构
- 重新判断分类仅处理已归档且非用户确认分类的文章
- 生成 AI 摘要和标签复用现有 `ai_generation_jobs` 队列
- 已排队或生成中的文章返回跳过，不重复创建任务
- 用户未配置 AI 时整批返回明确错误，不产生部分任务

### 发布与取消发布

- `publish` 沿用单篇发布语义：
  - 未归档文章先自动归档
  - 正文未准备好时逐篇返回 `BODY_NOT_READY`
  - 已发布且已有 `publicId` 的文章跳过，不刷新发布时间
  - 新发布文章生成或复用 `publicId`
- `unpublish` 将 `is_published` 设为 false
- 取消发布保留归档状态、归档时间和 `publicId`，后续重新发布继续使用原公开链接
- 批量结果提供发布成功的公开链接列表，便于继续分享

## API 设计

### 普通批量元数据操作

`POST /api/v1/articles/bulk-actions`

请求：

```json
{
  "action": "favorite | unfavorite | archive | unarchive | delete | permanent_delete | publish | unpublish",
  "articleIds": [1, 2, 3]
}
```

响应：

```json
{
  "requestedCount": 3,
  "succeededIds": [1, 2],
  "skipped": [{ "articleId": 3, "code": "ALREADY_FAVORITED" }],
  "failed": [{ "articleId": 3, "code": "BODY_NOT_READY", "message": "文章正文尚未准备完成" }],
  "publications": [{ "articleId": 1, "publicUrl": "/p/xxx" }]
}
```

约束：

- `articleIds` 去重、去无效 ID
- 首期单次上限 200 篇
- 所有操作必须通过当前用户元数据所有权校验
- 普通状态更新优先批量执行；天然逐篇处理的发布、彻底删除和 AI 触发允许部分成功

### 分类

`POST /api/v1/articles/bulk-category` 保留现有路径，补齐统一结果结构、ID 校验和上限。

### 重新判断分类

`POST /api/v1/articles/bulk-classify` 保留现有路径，但不再同步循环调用模型；先校验状态，再进入后台分类任务或沿用现有分类服务的可批量执行形式，避免前端 120 秒超时。

### AI 摘要和标签

`POST /api/v1/articles/bulk-regenerate-ai`

请求提交文章 ID，后端为每篇调用现有 `enqueueAiGeneration`。响应返回提交成功、已在队列和失败明细。

### 导出

`POST /api/v1/articles/bulk-export`

请求：

```json
{
  "articleIds": [1, 2, 3],
  "format": "zip | obsidian",
  "includeAi": true,
  "organizeByCategory": true
}
```

导出使用后台任务：

- `GET /api/v1/articles/bulk-export/:jobId` 查询状态
- `GET /api/v1/articles/bulk-export/:jobId/download` 下载文件
- 任务只允许创建者查询和下载
- 任务记录导出格式、数量、状态、失败明细和过期时间

## 导出内容

ZIP 根目录为 `storing-export-YYYYMMDD-HHmmss`。

通用 ZIP：

- `articles/分类/标题-ID.md`
- `manifest.json` 记录导出时间、文章列表和每篇结果
- 无分类文章进入 `articles/未分类/`

Obsidian ZIP：

- 结构适合解压到 Obsidian 保管库
- 默认包含 YAML frontmatter
- 保留标题、作者、来源、原文链接、发布时间、收藏时间、分类、标签和 AI 摘要
- 正文使用用户态缓存优先，其次共享原文，再触发只读回退
- 图片首期保留远程 URL，不下载附件

frontmatter 示例：

```yaml
---
title: 文章标题
author: 作者
source: 来源
url: 原文链接
published: 发布时间
saved: 收藏时间
category: 分类
tags:
  - 标签
summary: AI 摘要
storing_id: 123
---
```

文件名和目录名必须清理非法字符与路径分隔符，防止 Zip Slip；YAML 字符串必须转义，标题重复时追加 ID。

## 数据模型

新增 `bulk_export_jobs`：

- `id`
- `user_id`
- `format`
- `status`
- `requested_count`
- `succeeded_count`
- `failed_count`
- `failure_detail`
- `file_path`
- `file_size`
- `expires_at`
- `created_at`
- `updated_at`
- `finished_at`

任务文件写入服务端私有导出目录，下载时流式返回。过期任务由清理逻辑删除文件和任务记录。

## 前端架构

新增：

- `useArticleSelection`：选择集、全选已加载、反选、清理失效 ID
- `BulkActionBar`：动作按钮、确认弹窗、结果汇总
- `BulkResultDialog`：成功、跳过、失败和发布链接明细
- `useBulkArticleActions`：调用 API、刷新 SWR 缓存、处理错误

`ArchiveContent` 现有批量分类逻辑迁移到通用组件，收件箱、收藏、归档和已发布列表共用。

## 错误处理

- 请求整体无效时返回 400
- 未登录返回 401
- AI 未配置返回明确配置错误
- 单篇正文未准备好、分类不满足、已处于目标状态时进入 `skipped`
- 服务端异常进入 `failed`
- 前端刷新列表和计数，但不因部分失败丢弃已选上下文
- 导出失败保留任务失败原因，可重新提交新任务

## 测试计划

API 测试：

- 用户隔离和不存在文章
- 每种动作的目标状态跳过逻辑
- 批量发布自动归档、正文未准备、公开链接复用
- 取消发布保留归档状态和 `publicId`
- 共享文章彻底删除的引用计数和并发锁
- AI 队列去重与未配置错误
- 导出任务权限、状态流转、文件路径安全和 frontmatter 转义

Web 测试：

- 四个列表入口都能进入批量模式
- 分页加载后选择保留
- 删除和发布确认弹窗文案
- 批量结果展示成功、跳过、失败
- 操作后列表、计数和详情缓存刷新

工程验证：

- `pnpm lint`
- `pnpm build`
- 相关 API 单元测试
- Web 端桌面与移动视图的浏览器实测
