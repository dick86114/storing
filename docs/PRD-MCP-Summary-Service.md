# Storing — MCP 智能摘要服务 PRD

**产品名称：** Storing MCP 智能摘要服务  
**文档版本：** v1.0  
**最后更新：** 2026-07-14  
**文档状态：** 需求草案  

---

## 1. 产品概述

### 1.1 产品定位

MCP 智能摘要服务是 Storing 面向 Agent 的链接理解能力。外部 Agent 可以把网页链接发送给 Storing，由 Storing 完成网页抓取、正文提取、AI 摘要、分类和标签生成，并将结构化结果返回给 Agent。

该能力不是简单复用网页端收藏功能，而是一个具有身份、权限、归属和数据隔离能力的 Agent 接口层。

### 1.2 核心价值

| 用户/Agent 痛点 | 解决方案 |
|-----------------|----------|
| Agent 遇到长链接难以快速理解 | 调用 `summarize_url` 获取结构化摘要 |
| 用户不希望外部请求污染个人收件箱 | MCP 默认只返回摘要，不保存 |
| 多个 Agent/用户使用同一平台难以区分 | API Key 绑定 MCP client 和 owner user |
| 需要让 Agent 代用户收藏文章 | 调用 `collect_url` 明确保存到 owner 用户收件箱 |
| 对外开放后担心滥用 | client 级限流、权限、审计和禁用 |

### 1.3 目标用户

- 使用 Codex、Claude、Cursor、ChatGPT 等 Agent 的个人用户。
- 希望让 Agent 帮忙阅读、总结链接的知识工作者。
- 后续希望接入 Storing 摘要能力的第三方 Agent 或自动化工作流。

---

## 2. 用户故事

### 2.1 Agent 临时总结链接

```txt
作为一个 Agent 用户，
我希望把链接发给 Storing 后直接拿到摘要，
以便在对话中快速理解文章内容，且不把文章保存到我的稍后阅读列表。
```

验收标准：

- MCP 工具支持提交 URL。
- 默认不保存到收件箱。
- 返回标题、摘要、分类、标签和处理状态。
- 失败时返回可理解的错误原因。

### 2.2 Agent 代用户收藏链接

```txt
作为一个 Storing 用户，
我希望我的 Agent 可以代表我把有价值的链接保存到 Storing，
以便后续在网页端继续阅读和归档。
```

验收标准：

- 调用方必须具备 `inbox:write` 权限。
- 保存内容进入 API Key owner 对应用户空间。
- 不影响其他用户或服务账号的收件箱。
- 网页端能看到该内容来源为 MCP。

### 2.3 管理 MCP client

```txt
作为平台管理员，
我希望能给不同 Agent 发放独立 API Key，
以便区分调用来源、限流、审计和随时禁用。
```

验收标准：

- 每个 client 有独立名称、owner、权限、配额和启用状态。
- API Key 只展示一次，服务端只保存 hash。
- 禁用 client 后无法继续调用。
- 最近使用时间和请求统计可追踪。

### 2.4 防止垃圾请求污染业务

```txt
作为 Storing 主用户，
我希望外部 Agent 的大量请求不会进入我的个人收件箱，
以便个人阅读库保持干净。
```

验收标准：

- `summarize_url` 默认不写入个人 inbox。
- 外部 demo client 默认绑定服务账号或临时空间。
- 用户列表和搜索默认只展示当前用户自己的数据。
- MCP 来源内容可单独过滤。

---

## 3. 功能范围

### 3.1 MCP 工具

#### 3.1.1 `summarize_url`

功能：提交一个公开网页链接，返回 AI 摘要。

输入字段：

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| url | string | 是 | - | 需要总结的网页链接 |
| language | string | 否 | zh-CN | 摘要语言 |
| summary_style | string | 否 | brief | 摘要风格：brief / detailed / bullet |
| save_to_inbox | boolean | 否 | false | 是否保存到用户收件箱 |

输出字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| status | string | pending / running / completed / failed |
| job_id | number | 异步任务 ID |
| article_id | number | 文章 ID，完成后返回 |
| title | string | 文章标题 |
| summary | string | AI 摘要 |
| category | string | AI 分类 |
| tags | string[] | AI 标签 |
| saved_to_inbox | boolean | 是否保存到收件箱 |
| error | object | 失败信息 |

权限：`summary:create`。

#### 3.1.2 `get_collect_status`

功能：查询采集/摘要任务状态。

输入字段：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| job_id | number | 是 | 任务 ID |

约束：只能查询当前 client 自己创建的任务。

权限：`job:read:self`。

#### 3.1.3 `collect_url`

功能：把 URL 明确保存到当前 API Key owner 的 Storing 收件箱。

输入字段：

| 字段 | 类型 | 必填 | 默认值 | 说明 |
|------|------|------|--------|------|
| url | string | 是 | - | 需要收藏的网页链接 |
| inbox | string | 否 | default | 目标收件箱，第一阶段固定 default |

权限：`collect:create` + `inbox:write`。

---

## 4. Web/API 功能

### 4.1 API Key 管理

第一阶段可以通过脚本或管理员接口创建，不强制做 UI。

后续 UI 能力：

- 创建 MCP client。
- 查看 client 名称、权限、状态、最近使用时间。
- 禁用/启用 client。
- 重新生成 API Key。
- 查看调用统计。

### 4.2 文章来源展示

文章详情或列表可展示来源：

- 手动收藏
- 网页端采集
- MCP 收藏
- API 收藏

第一阶段可以只在数据库记录来源，不强制前端展示。

### 4.3 审计视图

后续管理页展示：

- 最近 MCP 请求。
- 成功/失败数量。
- 失败原因。
- 每个 client 的调用量。
- 高风险或高频域名。

---

## 5. 权限模型

### 5.1 用户角色

| 角色 | 说明 |
|------|------|
| admin | 平台管理员，可管理 client 和所有配置 |
| user | 普通用户，拥有自己的文章空间 |
| service | 服务账号，用于 bot、demo、系统任务 |

### 5.2 Client 权限

| scope | 说明 |
|-------|------|
| summary:create | 创建临时摘要请求 |
| collect:create | 创建采集任务 |
| inbox:write | 写入 owner 用户收件箱 |
| job:read:self | 查询自己创建的任务 |
| article:read:self | 读取自己有权限的文章结果 |

### 5.3 默认权限建议

| client 类型 | owner | scopes | default_save_to_inbox |
|-------------|-------|--------|-----------------------|
| 私人 Agent | admin | summary:create, collect:create, inbox:write, job:read:self | false |
| 外部 demo | mcp-bot | summary:create, job:read:self | false |
| 可信第三方 | 对应 user | summary:create, collect:create, inbox:write, job:read:self | false |

---

## 6. 数据规则

### 6.1 入库规则

| 请求类型 | 是否写 articles | 是否写 article_metadata | 是否进用户收件箱 |
|----------|----------------|-------------------------|------------------|
| summarize_url, save_to_inbox=false | 可以写内容缓存 | 不写或写临时记录 | 否 |
| summarize_url, save_to_inbox=true | 是 | 是 | 是 |
| collect_url | 是 | 是 | 是 |
| 网页端 collect | 是 | 是 | 是 |

### 6.2 用户隔离规则

- 用户只能看到自己的 `article_metadata`。
- MCP client 只能访问 owner 用户授权范围内的数据。
- `articles` 作为内容缓存可以复用，但不能直接作为用户可见列表来源。

### 6.3 去重规则

- `articles` 按 normalized URL 去重。
- 用户状态按 `user_id + article_id` 去重。
- 同一用户重复保存同一 URL 时更新已有状态，不重复生成列表项。

---

## 7. 错误码

| 错误码 | HTTP | 说明 |
|--------|------|------|
| MCP_UNAUTHORIZED | 401 | 缺少或无效 API Key |
| MCP_CLIENT_DISABLED | 403 | client 已禁用 |
| MCP_FORBIDDEN_SCOPE | 403 | 权限不足 |
| MCP_RATE_LIMITED | 429 | 超过限流 |
| BAD_URL | 400 | URL 无效或不允许抓取 |
| COLLECT_FAILED | 500 | 采集失败 |
| SUMMARY_FAILED | 500 | 摘要生成失败 |
| JOB_NOT_FOUND | 404 | 任务不存在或无权访问 |

---

## 8. 验收标准

### 8.1 MVP 验收

- 可以创建一个 MCP client 和 API Key。
- Agent 使用 API Key 调用 `summarize_url`。
- 请求成功后返回摘要、分类和标签。
- 默认不进入 admin 收件箱。
- 可以查询任务状态。
- 禁用 client 后调用失败。
- 无权限调用 `collect_url` 时返回权限错误。

### 8.2 用户隔离验收

- admin 和 mcp-bot 的文章列表互不污染。
- 同一 URL 可分别保存到不同用户空间。
- 搜索结果只返回当前用户有权访问的数据。
- 收藏、归档、取消归档只影响当前用户状态。

### 8.3 对外开放验收

- 每个 client 有独立限流。
- 请求日志可审计。
- 错误信息对 Agent 友好。
- 接入文档完整。
- 可撤销 API Key。

---

## 9. 后续扩展

- 支持更多摘要风格：研究型、执行摘要、问答型、对比型。
- 支持 Agent 指定输出 schema。
- 支持只抓正文不总结。
- 支持对一组 URL 批量总结。
- 支持 webhook 回调异步结果。
- 支持用户在网页端查看 Agent 提交历史。
- 支持按 client 统计 token 成本。
