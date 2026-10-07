# 三端统一认证会话长期修复设计

日期：2026-10-07

## 背景

近期用户反馈 Android、macOS 与 Web 都容易出现“登录过期”或被提示重新登录。排查确认三端问题并不完全相同：

- Android 在刷新令牌请求发生任何异常时会清空本地会话；同时多个 WorkManager Worker 与主进程可能并发使用同一个一次性刷新令牌，导致令牌被轮换后互相失效。
- macOS 的刷新有 actor 串行化和网络错误不清会话的保护，但存在 Keychain 到文件存储的迁移缺口，以及旧 `android` 类型 Mac 会话无法通过新版 `/macos/auth/refresh` 继续使用的问题。
- Web 使用固定 7 天的无状态 JWT Cookie，没有刷新机制。前端启动校验有独立的 3 秒超时，而 API 请求默认 10 秒超时；慢网时会被误判为未登录并重定向到发布页。
- 所有原生客户端共享一次性 refresh token 轮换风险：服务端已轮换成功但响应丢失时，客户端仍持旧令牌，下一次刷新会被拒绝。

本设计提供长期方案，而不是逐端补丁。

## 目标

1. 三端登录态统一具备可撤销、可恢复、可续期能力。
2. 网络波动、请求超时、DNS 失败、5xx、并发刷新和服务端已轮换但响应丢失，均不得导致客户端丢弃仍可恢复的会话。
3. 密码修改、退出登录、设备管理撤销对 Web、Android、macOS、浏览器扩展立即生效。
4. Android 与 macOS 从采集入口发现未登录时，在当前上下文弹出登录；登录成功后自动继续原采集操作。
5. 所有认证边界有机器可读错误码和自动化回归测试。

## 非目标

- 不引入独立 OAuth 授权服务器。
- 不把 refresh token 改成可无限重复使用的长期令牌。
- 不重构与认证无关的文章、AI、MCP 功能。
- 不保存明文 refresh token、Cookie secret 或密码。

## 总体方案

保留并演进现有 `mobile_sessions` 表，避免大规模迁表。该表从“移动端会话表”升级为所有 Storing 客户端的通用会话表：

- `android`
- `macos`
- `browser_extension`
- `web`

原生客户端继续使用短时 access token 加长时 refresh token。Web 改用 HttpOnly opaque session cookie，并把会话哈希存入同一张表。三端共享同一套空闲过期、绝对过期、撤销和轮换宽限规则。

推荐初始参数：

| 参数 | 值 | 说明 |
| --- | --- | --- |
| 空闲过期 | 90 天 | 成功访问或成功刷新后顺延 |
| 绝对过期 | 365 天 | 即使用户持续使用也必须重新认证 |
| 刷新宽限期 | 60 秒 | 允许刚轮换的旧 refresh token 恢复会话 |
| 宽限期重试上限 | 3 次 | 防止无限重放 |
| access token 有效期 | 30 分钟 | 保持现有行为，服务端每次仍查会话状态 |

## 服务端设计

### 数据模型

在 `mobile_sessions` 上增量添加字段：

- `previous_refresh_token_hash TEXT`：上一次已轮换 refresh token 的哈希。
- `rotation_grace_until TIMESTAMP`：旧 refresh token 可用于恢复的截止时间。
- `rotation_count INTEGER NOT NULL DEFAULT 0`：宽限期内旧令牌恢复次数。
- `absolute_expires_at TIMESTAMP`：会话绝对上限。

现有字段继续使用：

- `refresh_token_hash` 保存当前 refresh token 或 Web opaque cookie secret 的哈希。
- `expires_at` 表示空闲过期时间。
- `revoked_at` 表示撤销时间。
- `client_type` 区分客户端类型。

`previous_refresh_token_hash` 创建唯一索引；PostgreSQL 唯一索引允许多个空值，兼容旧行。

存量数据迁移按以下顺序执行，避免对已有大表直接添加非空列：

1. 添加 nullable 的 `absolute_expires_at`。
2. 回填 `absolute_expires_at = created_at + 365 days`；没有 `created_at` 的异常行使用 `expires_at`。
3. 回填完成后设置 `absolute_expires_at NOT NULL`。
4. `rotation_count` 使用默认 0 添加。

Web 会话复用现表时填充：

- `device_id = session_id`
- `device_name = 'Web 浏览器'`
- `app_version = 'web'`

### 刷新与恢复

refresh token 轮换必须在单个数据库事务中完成：

1. 先按当前 token 哈希查找有效会话。
2. 若找不到，再按旧 token 哈希查找仍在宽限期内、且未超过重试上限的会话。
3. 生成新 refresh token。
4. 将旧 token 哈希写入 `previous_refresh_token_hash`。
5. 写入新的 `rotation_grace_until` 与 `rotation_count`。
6. 顺延 `expires_at`，不得超过 `absolute_expires_at`。
7. 返回新 access token、新 refresh token、用户与会话信息。

使用当前有效 token 发起正常轮换时，`rotation_count` 重置为 0；只有通过旧 token 宽限恢复时递增。

宽限期恢复使用的是“客户端仍持有刚轮换掉的旧令牌”这一事实。它不是可重复使用的长期令牌；超过次数或时间后必须重新登录。

### Web 会话

Web 登录后不再写入无状态 7 天 JWT Cookie，改为写入 HttpOnly opaque cookie：

```text
storing_session=session_id.session_secret
```

服务端解析 session id，查找会话并校验 secret 哈希。校验成功时：

- 用户必须存在且为 active。
- 会话未撤销。
- 未超过空闲过期和绝对过期。
- 顺延 `expires_at`，不得超过绝对上限。
- 定期轮换 cookie secret，避免长期固定凭据。

迁移期继续接受旧 `storing_token` JWT：

1. 校验旧 JWT 签名、过期时间和用户状态。
2. 创建 `web` 类型数据库会话。
3. 删除旧 Cookie。
4. 写入新的 `storing_session` Cookie。

旧 JWT 升级必须在显式登录或验证接口中完成，不允许每次匿名访问都触发创建会话。

`/verify` 在迁移期需要同时处理两种输入：

- 旧 `storing_token` 有效时创建新 Web 会话并返回升级 Cookie。
- 新 `storing_session` 有效时校验并续期。
- 两者都无效时返回明确认证错误。

CSRF 保护在迁移期同时认可 `storing_token` 与 `storing_session`。迁移结束后只认可新 Cookie。

### 错误码

认证相关响应统一提供稳定错误码，并优先保留现有客户端已经依赖的值：

- `UNAUTHORIZED`：请求缺少凭据。
- `INVALID_TOKEN`：access token 缺失、无效或已过期。
- `INVALID_REFRESH_TOKEN`：refresh token 缺失、无效或已过期。
- `SESSION_EXPIRED`：空闲或绝对过期。
- `SESSION_REVOKED`：用户退出、设备撤销或改密后撤销。
- `USER_DISABLED`：账号禁用。
- `LOGIN_RATE_LIMITED`：登录或刷新限流。

新增错误码必须先出现在 API 契约测试中；旧客户端仍在使用的错误码在兼容期不得删除或改变含义。

网络失败由客户端本地判定，服务端不返回“网络失败”错误码。

### 撤销语义

- 用户退出：撤销当前会话。
- 修改密码：撤销该用户全部 Android、macOS、浏览器扩展与 Web 会话。
- 管理员禁用用户：撤销全部会话。
- 设备管理撤销：只撤销目标会话。
- 删除用户：级联删除或撤销全部会话，遵循现有外键策略。

## Android 设计

### 认证状态机

`AuthRepository` 返回类型化结果，不再用 `Boolean + null` 混合表达所有失败：

```kotlin
sealed interface MobileAuthResult {
  data class Available(val user: MobileUser) : MobileAuthResult
  data object Offline : MobileAuthResult
  data object AuthenticationRequired : MobileAuthResult
  data object Forbidden : MobileAuthResult
}
```

处理规则：

- `IOException`、超时、DNS 失败、5xx 视为 `Offline`，保留本地 refresh token。
- 明确 `SESSION_EXPIRED`、`SESSION_REVOKED` 或当前 refresh token 无效时，才清空本地会话并返回 `AuthenticationRequired`。
- `USER_DISABLED` 返回 `Forbidden`，不提示重新登录。
- 只有本地 refresh token 已过期或缺失时，才允许客户端主动清理。

### 并发与写入

- `AuthRepository` 使用全局 `Mutex` 串行化刷新。
- 多个调用者等待同一次刷新结果，不得重复发送刷新请求。
- Worker 不再自行创建 Retrofit 和调用 refresh API，统一注入同一个认证协调器。
- 写入新会话时使用条件检查：只有本地仍持有发起刷新时的旧 refresh token，才允许写入新 token；迟到响应不得覆盖更新会话。

### 采集衔接

Android 分享接收页在提交 URL 或微信文件时，如果返回未登录：

1. 不退出当前页面，不丢弃已选 URL 或文件。
2. 在当前页面弹出登录 Bottom Sheet。
3. 登录成功后自动重试原操作。
4. 成功后显示原有采集结果，并按现有逻辑调度任务跟踪。
5. 用户取消登录时保留待处理内容；下次进入时可继续。

URL 采集继续使用本地 pending 队列。文件采集必须先把临时 content URI 复制到应用私有目录，再进入登录流程；登录成功后使用私有文件重试上传。

## macOS 设计

### 会话存储迁移

当前默认 `FileSessionStore` 无法读取旧版 Keychain token。启动恢复流程增加一次性迁移：

1. 文件会话不存在时尝试读取旧 Keychain 会话。
2. 找到旧 refresh token 后写入文件存储。
3. 用该 token 完成一次新版会话刷新或迁移。
4. 成功建立有效会话后再清理 Keychain 记录。
5. 网络失败时保留 Keychain 与文件数据，等待下次重试。

### 旧会话类型迁移

旧 Mac 版本曾通过 mobile 接口创建 `android` 类型会话。仅凭客户端 fallback 到 mobile 接口会掩盖真实失效，因此提供服务端显式迁移：

1. macOS 刷新接口返回当前 token 无效。
2. 客户端确认本地 token 属于旧版本保存的会话。
3. 调用一次性 macOS 会话迁移接口。
4. 服务端验证 token 仍有效后，把会话 `client_type` 从 `android` 更新为 `macos`，并轮换 refresh token。
5. 迁移接口仅在兼容期内开放，并写审计日志。

### 认证状态机

macOS 启动恢复状态区分：

- `loading`
- `authenticated`
- `offline`
- `authenticationRequired`

网络失败不得把用户显示为未登录，也不得清空本地会话。

### 快速采集衔接

菜单栏 QuickCollect 面板在未登录或提交时收到认证失败：

1. 保留用户输入的 URL 和确认状态。
2. 在面板内弹出登录 Sheet，不强制打开主窗口。
3. 登录成功后自动提交原 URL。
4. 提交成功后展示任务状态。

微信导入目录继续保留失败批次。登录成功或网络恢复后自动重试。

## Web 设计

### 启动状态机

`AuthContext` 状态改为：

- `loading`
- `authenticated`
- `unauthenticated`
- `bootFailed`

规则：

- `/verify` 请求进行中保持 `loading`。
- 明确 401 / 403 才进入 `unauthenticated`。
- 超时、断网、5xx 进入 `bootFailed`。
- `bootFailed` 不重定向到发布页，显示网络错误与重试按钮。
- 移除 3 秒独立启动超时；认证校验超时必须与 API 客户端一致，默认 10 秒。

### 私有路由

只有明确 `unauthenticated` 时才跳转发布页或显示登录入口。`loading` 与 `bootFailed` 均不得把用户当成游客。

### 会话续期

Web 使用数据库滑动会话后：

- 正常访问自动顺延空闲过期时间。
- 浏览器保留 HttpOnly Cookie，不接触明文 secret。
- 密码修改后旧 Cookie 立即失效。
- 旧 JWT Cookie 在兼容期内自动升级，用户不需要重新登录。

## 可观测性

认证日志只记录以下信息：

- 用户 ID。
- 会话 ID。
- 客户端类型。
- 结果：登录、刷新、宽限恢复、撤销、失败。
- 错误码。
- 请求耗时。

禁止记录：

- refresh token。
- access token。
- Cookie。
- 密码。
- Authorization 头。

核心观察指标：

- refresh 成功率。
- 宽限期恢复次数。
- 并发刷新去重次数。
- 客户端本地会话丢失率。
- 未登录采集拦截次数。
- 登录后自动续跑成功率。

## 测试计划

### API

- 当前 refresh token 正常轮换。
- 服务端轮换后响应丢失，60 秒内旧 token 可恢复。
- 宽限期超过 60 秒或 3 次后拒绝。
- 并发刷新只保留一个有效会话。
- 密码修改撤销全部客户端会话。
- Web opaque cookie 创建、续期、撤销。
- 旧 Web JWT 一次性升级。
- 所有认证错误码稳定。

### Android

- 网络超时不清 refresh token。
- DNS 失败不清 refresh token。
- 明确认证失效才清本地会话。
- 并发刷新只发起一次网络请求。
- 迟到响应不覆盖新会话。
- Worker 与主进程复用同一认证协调器。
- 分享 URL 未登录时弹出页内登录，登录后自动提交。
- 分享文件未登录时弹出页内登录，登录后自动导入。

### macOS

- Keychain token 一次性迁移到文件。
- 网络失败保留本地会话。
- 旧 `android` 类型 Mac 会话迁移为 `macos`。
- QuickCollect 未登录时页内登录并自动提交原 URL。
- 登录取消后 URL 不丢失。
- 微信批次失败后保留并自动重试。

### Web

- 慢 `/verify` 不触发未登录跳转。
- 401 才进入登录态。
- 断网与 5xx 显示可重试错误。
- 旧 JWT 自动升级为新数据库会话。
- 改密后旧 Web Cookie 失效。

## 发布顺序

1. 部署兼容新版 API：新字段、新 Web 会话、宽限恢复、旧客户端兼容。
2. 发布 Web，启用数据库滑动会话与旧 Cookie 自动升级。
3. 发布 Android 与 macOS，启用统一认证协调器和采集登录衔接。
4. 观察认证指标，确认宽限恢复和本地会话丢失率下降。
5. 兼容期结束后移除旧 Web JWT 升级和旧 Mac 会话迁移入口。

## 验收标准

- 断网、超时、DNS 失败后，Android 与 macOS 本地 refresh token 仍保留。
- 20 个并发刷新请求只产生一次真实网络刷新。
- 服务端轮换成功但响应丢失后，60 秒内旧 token 重试可恢复。
- 密码修改、退出、设备撤销对三端立即生效。
- Web 慢网启动不被误判为未登录。
- 旧 Web JWT Cookie 自动升级，不强制重新登录。
- macOS 旧 Keychain 与旧 mobile 会话自动迁移。
- Android 分享 URL 时未登录，页内登录后自动提交并出现采集任务。
- Android 分享文件时未登录，页内登录后自动导入。
- macOS QuickCollect 未登录时，面板内登录后自动提交原 URL。
- 全链路日志不泄露 token、Cookie 或密码。
