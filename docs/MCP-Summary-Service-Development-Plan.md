# Storing — MCP 智能摘要服务开发计划

**文档版本：** v1.0  
**最后更新：** 2026-07-14  
**文档状态：** 开发计划草案  

---

## 1. 开发目标

分阶段把 Storing 从单用户网页收藏平台，演进为可被 Agent 安全调用的 MCP 智能摘要服务。

核心目标：

1. 先让 Agent 能提交 URL 并拿到摘要。
2. 默认不污染个人收件箱。
3. 逐步补齐用户级数据隔离。
4. 最后再做对外开放能力。

---

## 2. 阶段划分

| 阶段 | 名称 | 目标 | 建议优先级 |
|------|------|------|------------|
| Phase 0 | 准备与技术确认 | 梳理当前采集/摘要链路，确定 MCP server 形态 | P0 |
| Phase 1 | 内部 MCP MVP | 支持 API Key + summarize_url + 任务查询 | P0 |
| Phase 2 | 用户级收件箱隔离 | 改造 article_metadata 为 user-scoped | P0 |
| Phase 3 | collect_url 与来源管理 | 支持 Agent 明确保存到 owner inbox | P1 |
| Phase 4 | 管理、审计、限流 | 支持对外开放前的管控能力 | P1 |
| Phase 4.5 | MCP 管理控制台与接入引导 | 用户/Client 管理、Key 生命周期、客户端配置向导 | P1 |
| Phase 5 | 对外接入文档与稳定性 | 文档、示例、监控、清理策略 | P2 |

---

## 3. Phase 0：准备与技术确认

### 3.1 任务清单

- [ ] 梳理现有 `/collect`、`collect.service.ts`、AI 摘要生成、文章内容缓存链路。
- [ ] 确认 MCP server 部署方式：
  - [ ] 与 API 服务同进程。
  - [ ] 独立 Node 服务，通过内部 HTTP 调 API。
  - [ ] 独立 npm 包/stdio MCP server。
- [ ] 确认 Agent 接入方式：Codex/Claude Desktop/其他 MCP host。
- [ ] 确认第一阶段摘要结果是否必须同步返回。
- [ ] 确认 API Key 生成和保存策略。

### 3.2 推荐决策

MVP 推荐：

- MCP server 独立于 web UI，但复用 API 服务能力。
- API 服务提供内部 REST endpoint，MCP server 调用 REST。
- 摘要可能耗时，MCP 工具支持异步 job 查询。

### 3.3 交付物

- 技术决策记录。
- MCP 工具 schema 草案。
- 数据迁移草案。

---

## 4. Phase 1：内部 MCP MVP

### 4.1 目标

支持自己的 Agent 通过 API Key 调用 Storing，总结链接并返回摘要；默认不进入个人收件箱。

### 4.2 数据库改造

#### 4.2.1 users 表增加角色

新增字段：

```txt
role text default 'admin'
status text default 'active'
```

历史 admin 用户迁移为：

```txt
role = 'admin'
status = 'active'
```

#### 4.2.2 新增 mcp_clients 表

```txt
mcp_clients
- id serial primary key
- name text not null
- owner_user_id integer not null references users(id)
- api_key_hash text not null unique
- scopes text[] not null default '{}'
- enabled boolean not null default true
- rate_limit_per_minute integer
- rate_limit_per_day integer
- default_save_to_inbox boolean not null default false
- created_at timestamp default now()
- updated_at timestamp default now()
- last_used_at timestamp
```

#### 4.2.3 collect_jobs 增加字段

```txt
user_id integer references users(id)
client_id integer references mcp_clients(id)
request_source text default 'web'
save_to_inbox boolean default true
```

迁移策略：

- 历史 job 归属到 admin。
- 历史网页端 job：`request_source='web'`，`save_to_inbox=true`。

### 4.3 后端改造

- [ ] 新增 MCP/API Key 认证中间件。
- [ ] 支持 `Authorization: Bearer sk-storing-...` 或 `X-Storing-Api-Key`。
- [ ] 新增 client scope 检查工具。
- [ ] `createCollectJob` 支持传入：
  - `userId`
  - `clientId`
  - `requestSource`
  - `saveToInbox`
- [ ] `processCollectJob` 完成后，当 `saveToInbox=false` 时不写入用户收件箱状态，或只写内容缓存。
- [ ] 返回摘要结果时复用现有 AI 摘要生成逻辑。

### 4.4 MCP 工具

- [ ] `summarize_url`
  - 默认 `save_to_inbox=false`。
  - 需要 `summary:create`。
- [ ] `get_collect_status`
  - 只能查询当前 client 创建的 job。
  - 需要 `job:read:self`。

### 4.5 管理脚本

- [ ] 新增脚本创建 service user：`mcp-bot`。
- [ ] 新增脚本创建 MCP client 并生成 API Key。
- [ ] API Key 明文只输出一次。

### 4.6 验收标准

- [ ] 可以生成一个 MCP API Key。
- [ ] 使用该 API Key 提交链接。
- [ ] 返回 job_id 或摘要结果。
- [ ] 完成后可查询摘要、分类、标签。
- [ ] 默认不进入 admin inbox。
- [ ] 禁用 client 后调用失败。
- [ ] 无 scope 时返回 403。

### 4.7 风险点

- 当前摘要生成可能是异步 side effect，需要整理“何时可返回摘要”。
- `upsertArticleFromCapture` 当前默认写 `article_metadata` 且 `isArchived=true`，需要拆出“只写内容缓存”的路径。
- 外部网页抓取耗时较长，MCP host 可能超时，建议优先异步。

---

## 5. Phase 2：用户级收件箱隔离

### 5.1 目标

实现真正的“谁发的就进谁的收件箱”，避免服务账号、外部 client、admin 数据互相污染。

### 5.2 数据库改造

#### 5.2.1 article_metadata 增加用户维度

新增字段：

```txt
user_id integer references users(id)
source_type text default 'web'
client_id integer references mcp_clients(id)
```

索引调整：

当前：

```txt
unique(article_id)
```

目标：

```txt
unique(user_id, article_id)
```

历史数据迁移：

- 找到 admin 用户 ID。
- 所有历史 `article_metadata.user_id = admin.id`。
- 补齐 `source_type='web'`。

### 5.3 后端接口改造

需要逐个检查并改造：

- [ ] `GET /articles`
- [ ] `GET /articles/:id`
- [ ] `POST /articles/:id/favorite`
- [ ] `POST /articles/:id/unfavorite`
- [ ] `POST /articles/:id/archive`
- [ ] `POST /articles/:id/unarchive`
- [ ] `POST /articles/:id/refetch`
- [ ] `GET /search`
- [ ] counts 相关接口
- [ ] Wiki 入库触发逻辑

核心规则：

```txt
所有用户可见状态都必须 where article_metadata.user_id = current_user.id
```

### 5.4 服务层改造

- [ ] `ensureMetadata(articleId)` 改为 `ensureMetadata(userId, articleId)`。
- [ ] `generateSummaryAndTags(articleId)` 评估是否应改为 user-scoped。
- [ ] `processCoverImage(articleId)` 可继续 article-scoped 或 metadata-scoped。
- [ ] Wiki 相关逻辑默认只处理当前用户归档内容，第一阶段可只支持 admin。

### 5.5 前端影响

如果 API 响应字段保持兼容，前端改造较少。

需要确认：

- [ ] 登录用户切换后列表是否正确刷新。
- [ ] 搜索是否只返回当前用户数据。
- [ ] 文章详情中的收藏/归档状态是否来自当前用户 metadata。

### 5.6 验收标准

- [ ] admin 历史文章正常显示。
- [ ] mcp-bot 文章不出现在 admin inbox。
- [ ] 同一个 URL 可分别保存到 admin 和 mcp-bot。
- [ ] 收藏/归档操作只影响当前用户。
- [ ] 搜索只搜当前用户空间。
- [ ] `pnpm lint` 通过。

### 5.7 风险点

- 这是最大结构性迁移，涉及多处查询。
- Wiki 当前可能假设归档文章是全局的，需要明确 Wiki 是否按用户隔离。
- 如果外部 articles 表由其他系统写入，要确认 ID 和 URL 去重策略不被破坏。

---

## 6. Phase 3：collect_url 与来源管理

### 6.1 目标

支持 Agent 明确保存文章到 owner 用户的收件箱，并在系统中标记来源为 MCP。

### 6.2 后端任务

- [ ] 新增 `collect_url` MCP 工具。
- [ ] 校验 `collect:create` 和 `inbox:write`。
- [ ] 保存时写：
  - `user_id = client.owner_user_id`
  - `client_id = client.id`
  - `source_type = 'mcp'`
  - `save_to_inbox = true`
- [ ] 重复保存同一 URL 时更新当前用户 metadata，不重复创建用户项。

### 6.3 前端任务

- [ ] 文章列表可选展示来源 badge。
- [ ] 归档/收件箱可选按来源过滤。
- [ ] 默认不改变当前 UI，避免增加复杂度。

### 6.4 验收标准

- [ ] 私人 Agent 可以明确收藏链接。
- [ ] 收藏结果进入 owner 用户 inbox。
- [ ] 文章来源记录为 MCP。
- [ ] 其他用户看不到该收藏状态。

---

## 7. Phase 4：管理、审计、限流

### 7.1 目标

对外开放前具备最基本运营和安全能力。

### 7.2 限流

- [ ] 实现 client 级每分钟限流。
- [ ] 实现 client 级每日限流。
- [ ] 实现并发采集限制。
- [ ] 超限返回 `MCP_RATE_LIMITED`。

### 7.3 审计日志

可新增：

```txt
mcp_request_logs
- id
- client_id
- user_id
- tool_name
- url
- normalized_url
- status
- error_code
- duration_ms
- created_at
```

任务：

- [ ] 每次 MCP 调用记录日志。
- [ ] 记录成功、失败、耗时。
- [ ] 记录安全拦截原因。

### 7.4 管理能力

- [ ] 管理员查看 MCP clients。
- [ ] 管理员禁用/启用 client。
- [ ] 管理员查看最近请求。
- [ ] 支持轮换 API Key。

### 7.5 验收标准

- [ ] 高频调用会被限流。
- [ ] 管理员可以定位是哪个 client 在调用。
- [ ] 禁用 client 即刻生效。
- [ ] 日志可用于排查失败。

---

## 7.5a Phase 4.5：MCP 管理控制台与接入引导

### 7.5a.1 目标

把 Phase 1-4 已完成的后端 MCP 能力产品化，形成两条清晰链路：普通登录用户自助申请和管理自己的 MCP Key；管理员通过独立运营控制台管理用户空间、连接生命周期、配额与审计。

### 7.5a.2 后端范围

- [ ] 管理员查看用户列表。
- [ ] 管理员创建用户或 service 账号。
- [ ] 管理员启用/禁用用户、调整角色、重置密码。
- [ ] 管理员创建 MCP client，并一次性返回明文 API Key。
- [ ] 管理员删除/吊销 MCP client。
- [ ] 管理员更新 client 权限、限流、并发采集限制。
- [ ] 管理员轮换 API Key，并一次性返回新 key。
- [ ] 登录用户可以只针对自己的 user space 创建、更新、暂停、轮换和吊销 MCP client。
- [ ] 禁用用户后，其 MCP client 不应继续通过鉴权。

### 7.5a.3 前端范围

- [ ] 新增 `/settings/mcp` 我的 MCP 页面，所有登录用户可访问。
- [ ] 新增 `/admin/mcp` MCP 运营控制台，仅 admin 可访问。
- [ ] 我的 MCP 展示当前用户自己的 clients、状态、scopes、配额、最近使用时间。
- [ ] 管理控制台展示全部 clients、owner、状态、scopes、配额、最近使用时间。
- [ ] 普通用户支持创建自己的 client：输入名称、选择 scopes、配置配额。
- [ ] 管理员支持创建 client：选择 owner、输入名称、选择 scopes、配置配额。
- [ ] 新 key/轮换 key 只在结果面板展示一次，并提供复制按钮。
- [ ] 支持启用/禁用、删除 client。
- [ ] 支持查看和筛选最近 MCP request logs。
- [ ] 提供 Codex/Claude Desktop 风格的 MCP JSON 配置示例。
- [ ] 提供工具调用流程说明：`summarize_url` / `collect_url` / `get_collect_status`。

### 7.5a.4 验收标准

- [ ] 普通用户能在登录后自主完成创建 MCP API Key、复制客户端配置、查看调用记录的全流程。
- [ ] 管理员能在浏览器内完成从创建 owner 到生成 MCP API Key 的全流程。
- [ ] 管理员能复制客户端配置并看到该 key 对应的 scopes。
- [ ] 管理员能禁用/删除 client，后续调用不可继续使用。
- [ ] 管理员能通过日志定位失败、限流和耗时。
- [ ] 非 admin 用户不能访问管理员 API，但可以访问自己的 MCP 页面和 self-service API。

---

## 8. Phase 5：对外接入与稳定性

### 8.1 接入文档

- [ ] MCP server 安装方式。
- [ ] API Key 配置方式。
- [ ] 工具说明。
- [ ] 示例调用。
- [ ] 错误码。
- [ ] 安全限制。

### 8.2 稳定性

- [ ] 临时摘要 TTL 清理任务。
- [ ] 失败 job 清理任务。
- [ ] 抓取超时和重试策略。
- [ ] 域名黑名单。
- [ ] 私网 IP 和 SSRF 防护测试。

### 8.3 观测

- [ ] 采集成功率。
- [ ] 摘要成功率。
- [ ] 平均耗时。
- [ ] client 调用排行。
- [ ] 错误类型排行。

---

## 9. 建议实施顺序

推荐顺序：

1. Phase 0：确认 MCP server 形态。
2. Phase 1：先做内部 summarize MVP。
3. Phase 2：做 user-scoped metadata，这是长期正确性的核心。
4. Phase 3：开放 collect_url。
5. Phase 4：补齐限流审计。
6. Phase 4.5：补齐 MCP 管理控制台与接入引导。
7. Phase 5：整理文档后对外试用。

不建议一开始就做完整管理 UI。可以先用脚本创建 API Key 和 service user。

---

## 10. 回滚策略

### 10.1 Phase 1 回滚

Phase 1 主要新增表和字段，风险较低。

回滚方式：

- 停用 MCP server。
- 禁用所有 mcp_clients。
- 网页端 `/collect` 保持原逻辑。

### 10.2 Phase 2 回滚

Phase 2 涉及 `article_metadata` 唯一约束调整，风险较高。

上线前需要：

- 完整数据库备份。
- 编写可重复执行的数据迁移脚本。
- 在测试库验证历史数据迁移。
- 保留旧查询逻辑分支或 feature flag。

---

## 11. 测试计划

### 11.1 单元测试

- URL normalize。
- API Key hash 和验证。
- scope 检查。
- user-scoped metadata upsert。
- job 权限检查。

### 11.2 集成测试

- 网页端 collect。
- MCP summarize，不入库。
- MCP collect，入 owner inbox。
- 禁用 client。
- 超限 client。
- 同 URL 多用户保存。

### 11.3 回归测试

- 收件箱列表。
- 收藏夹列表。
- 归档列表。
- 搜索。
- 文章详情。
- 归档触发 AI 摘要。
- Wiki 相关入口。

---

## 12. 里程碑建议

### M1：内部可用

包含：

- mcp_clients 表。
- API Key 验证。
- summarize_url。
- get_collect_status。
- 默认不入 admin inbox。

### M2：数据隔离正确

包含：

- article_metadata user-scoped。
- 列表、搜索、收藏、归档按用户隔离。
- 历史数据迁移。

### M3：可受控开放

包含：

- collect_url。
- scopes。
- 限流。
- 审计。
- 管理脚本或基础管理页。

### M4：对外试用

包含：

- 接入文档。
- 示例配置。
- 清理任务。
- 基础监控。

> Phase 4.5 implementation note: ordinary users cannot set per-minute, per-day, or concurrent limits in the self-service flow. The single `mcp_platform_settings` record stores administrator-managed defaults and is applied to subsequently created self-service MCP clients. Existing clients preserve their assigned limits; administrators can still set client-specific exceptions.
