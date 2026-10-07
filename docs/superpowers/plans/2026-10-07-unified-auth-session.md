# 三端统一认证会话长期修复实施计划

> **给执行代理的要求：** 必须使用 superpowers:subagent-driven-development（推荐）或 superpowers:executing-plans 按任务逐项执行。步骤使用 `- [ ]` 复选框跟踪。

**目标：** 建立三端统一、可撤销、可恢复、可续期的认证会话体系，并让 Android 与 macOS 的采集入口在未登录时页内登录后自动续跑原任务。

**架构：** 先在 API 演进现有 `mobile_sessions` 为通用客户端会话表，加入 90 天空闲过期、365 天绝对过期和 60 秒刷新宽限；Web 改用 HttpOnly 数据库会话 Cookie；Android 与 macOS 复用服务端会话语义，实现类型化认证状态、串行刷新和网络失败保留令牌。采集入口通过持久化待授权动作实现登录后自动重试。

**技术栈：** Hono、Drizzle、PostgreSQL、Next.js、React、SWR、Kotlin、Coroutines、Hilt、WorkManager、Room、Swift Concurrency、SwiftUI、Security.framework。

**设计文档：** `docs/superpowers/specs/2026-10-07-unified-auth-session-design.md`

## 全局约束

- 所有新增注释、文档、用户可见文案使用中文。
- 前端包管理必须使用 `pnpm`，禁止使用 `npm`。
- 空闲过期为 90 天，绝对过期为 365 天，刷新宽限为 60 秒，宽限重试上限为 3 次。
- access token 有效期保持 30 分钟。
- 服务端只保存 token 或 Cookie secret 的 SHA-256 哈希。
- 认证日志禁止记录 refresh token、access token、Cookie、密码或 Authorization 头。
- 兼容期保留旧错误码含义，不得让已发布客户端无法识别认证失败。
- 迁移期 CSRF 保护同时认可 `storing_token` 与 `storing_session`。
- 每个任务必须先写失败测试，再实现，再运行该任务声明的验证命令。
- 每个任务完成后独立提交，提交信息使用中文或项目既有 conventional commit 风格。

## 评审重点

- **旧 Web Cookie 升级失败：** API 契约测试必须覆盖有效旧 JWT 换新会话、无效旧 JWT 明确 401、双 Cookie 同时存在的优先级。
- **并发刷新竞态：** 服务端测试必须覆盖当前 token、旧 token 宽限恢复、超过次数或时间后拒绝；Android/macOS 测试必须覆盖并发调用只发起一次刷新。
- **网络失败误清会话：** Android 与 macOS 的单元测试必须分别模拟超时、DNS 失败和 5xx，断言本地 refresh token 仍保留。
- **采集文件权限丢失：** Android 测试必须证明 content URI 已复制到私有目录后才进入登录流程，登录成功后仍能上传。
- **CSRF 误拦截新 Web 会话：** API 测试必须覆盖 `storing_session` 的同源写请求，以及迁移期双 Cookie 场景。
- **绝对过期失效：** 服务端测试必须证明续期不能越过 `absolute_expires_at`。

---

### 任务 1：通用会话表策略与刷新宽限基础

**文件：**

- 修改：`apps/api/src/db/schema.ts`
- 修改：`apps/api/src/services/mobile-session.service.ts`
- 修改：`apps/api/src/index.ts`
- 测试：`apps/api/test/mobile-session.service.test.ts`
- 创建：`apps/api/test/unified-session-rotation.test.ts`

**接口：**

- 使用：现有 `db`、`mobileSessions`、Drizzle SQL 执行能力。
- 产出：
  - `export const SESSION_IDLE_TTL_MS = 90 * 24 * 60 * 60 * 1000`
  - `export const SESSION_ABSOLUTE_TTL_MS = 365 * 24 * 60 * 60 * 1000`
  - `export const REFRESH_ROTATION_GRACE_MS = 60 * 1000`
  - `export const MAX_REFRESH_ROTATION_RECOVERIES = 3`
  - `export type ClientSessionType = 'android' | 'browser_extension' | 'macos' | 'web'`
  - `export type MobileSessionSummary` 增加 `absoluteExpiresAt`、`rotationGraceUntil`、`rotationCount`
  - `export function calculateSessionWindows(now: Date, createdAt: Date): { expiresAt: Date; absoluteExpiresAt: Date }`
  - `export function canRecoverRotatedRefreshToken(session: Pick<MobileSessionSummary, 'revokedAt' | 'rotationGraceUntil' | 'rotationCount'>, now: Date): boolean`

- [ ] **步骤 1：写会话窗口与宽限策略失败测试**

在 `apps/api/test/mobile-session.service.test.ts` 增加：

```ts
test('统一会话使用 90 天空闲窗口、365 天绝对窗口和 60 秒刷新宽限', () => {
  const now = new Date('2026-10-07T08:00:00.000Z');
  const createdAt = new Date('2026-10-01T08:00:00.000Z');
  const windows = calculateSessionWindows(now, createdAt);

  assert.equal(windows.expiresAt.toISOString(), '2027-01-05T08:00:00.000Z');
  assert.equal(windows.absoluteExpiresAt.toISOString(), '2027-10-01T08:00:00.000Z');
});
```

并覆盖：

- `rotationCount < 3` 且 `now < rotationGraceUntil` 时允许恢复。
- `rotationCount >= 3`、宽限期已过或会话已撤销时拒绝。

- [ ] **步骤 2：写 schema 和初始化契约失败测试**

创建 `apps/api/test/unified-session-rotation.test.ts`，静态断言：

- schema/service 包含 `previous_refresh_token_hash`、`rotation_grace_until`、`rotation_count`、`absolute_expires_at`。
- `initMobileSessionSchema()` 先添加 nullable `absolute_expires_at`，回填后设置 NOT NULL。
- `previous_refresh_token_hash` 有唯一索引。
- `client_type` 包含 `web`。

- [ ] **步骤 3：运行测试确认失败**

```bash
cd apps/api
node --test test/mobile-session.service.test.ts test/unified-session-rotation.test.ts
```

预期：因新增常量、函数和字段不存在而失败。

- [ ] **步骤 4：实现 schema 与会话窗口策略**

在 schema 与启动初始化中执行：

1. 添加 nullable `absolute_expires_at`。
2. 按设计回填并最终设为 NOT NULL。
3. 添加带默认值的 `rotation_count`。
4. 添加 nullable `previous_refresh_token_hash` 与 `rotation_grace_until`。
5. 创建旧 token 哈希唯一索引。
6. `createMobileSession()` 统一使用 `calculateSessionWindows()`。

- [ ] **步骤 5：运行任务测试与 API 构建**

```bash
cd apps/api
node --test test/mobile-session.service.test.ts test/unified-session-rotation.test.ts
pnpm build
```

预期全部通过。

- [ ] **步骤 6：提交**

```bash
git add apps/api/src/db/schema.ts apps/api/src/services/mobile-session.service.ts apps/api/src/index.ts apps/api/test/mobile-session.service.test.ts apps/api/test/unified-session-rotation.test.ts
git commit -m "feat(api): 建立通用会话窗口与刷新宽限基础"
```

### 任务 2：事务化令牌轮换与会话恢复

**文件：**

- 修改：`apps/api/src/services/mobile-session.service.ts`
- 创建：`apps/api/src/services/auth-telemetry.service.ts`
- 测试：`apps/api/test/unified-session-rotation.test.ts`
- 测试：`apps/api/test/mobile-auth-contract.test.mjs`
- 测试：`apps/api/test/macos-auth-contract.test.mjs`

**接口：**

- 使用：任务 1 的常量、`canRecoverRotatedRefreshToken()`、schema 字段。
- 产出：
  - `export async function rotateMobileSession(refreshToken: string, device?: MobileDevice, clientType?: ClientSessionType): Promise<MobileSessionRotation | null>`
  - `export type MobileSessionRotation = { refreshToken: string; session: MobileSessionSummary; userId: number; recoveredByRotationGrace: boolean }`
  - `export async function logAuthEvent(input: { userId?: number; sessionId?: string; clientType?: ClientSessionType; event: string; errorCode?: string; durationMs?: number }): Promise<void>`

- [ ] **步骤 1：写事务轮换与宽限恢复失败测试**

测试必须断言：

- 正常当前 token 轮换后，旧哈希进入 `previous_refresh_token_hash`。
- 当前 token 轮换将 `rotationCount` 重置为 0。
- 旧 token 在 60 秒内可恢复并返回新 token。
- 每次宽限恢复递增 `rotationCount`。
- 第 4 次旧 token 恢复被拒绝。
- 宽限期过期后拒绝。
- 续期后的 `expiresAt` 不超过 `absoluteExpiresAt`。
- 轮换逻辑在 `db.transaction()` 内执行。

- [ ] **步骤 2：写认证日志安全契约失败测试**

断言 `auth-telemetry.service.ts`：

- 只接收 userId、sessionId、clientType、event、errorCode、durationMs。
- 不导入或记录请求头。
- 源码不出现 `console.log` 输出 token、Cookie 或 Authorization。

- [ ] **步骤 3：运行测试确认失败**

```bash
cd apps/api
node --test test/unified-session-rotation.test.ts test/mobile-auth-contract.test.mjs test/macos-auth-contract.test.mjs
```

- [ ] **步骤 4：实现事务化轮换**

实现要求：

1. 先按当前哈希查找有效会话。
2. 找不到时按旧哈希查找，并调用 `canRecoverRotatedRefreshToken()`。
3. 在事务内生成新 token、写入旧哈希、宽限期、次数、空闲过期和绝对过期。
4. 更新条件包含未撤销和预期旧哈希，防止并发覆盖。
5. 记录恢复事件，不记录任何凭据。

- [ ] **步骤 5：运行测试与构建**

```bash
cd apps/api
node --test test/unified-session-rotation.test.ts test/mobile-auth-contract.test.mjs test/macos-auth-contract.test.mjs
pnpm build
```

- [ ] **步骤 6：提交**

```bash
git add apps/api/src/services/mobile-session.service.ts apps/api/src/services/auth-telemetry.service.ts apps/api/test/unified-session-rotation.test.ts apps/api/test/mobile-auth-contract.test.mjs apps/api/test/macos-auth-contract.test.mjs
git commit -m "feat(api): 事务化刷新令牌轮换与宽限恢复"
```

### 任务 3：Web 数据库会话与旧 JWT 迁移

**文件：**

- 创建：`apps/api/src/services/web-session.service.ts`
- 修改：`apps/api/src/middleware/auth.ts`
- 修改：`apps/api/src/routes/auth.ts`
- 修改：`apps/api/src/db/schema.ts`
- 测试：`apps/api/test/web-session.service.test.ts`
- 测试：`apps/api/test/cookie-auth-hardening.test.mjs`
- 测试：`apps/api/test/unified-session-rotation.test.ts`

**接口：**

- 使用：任务 1、2 的会话创建、轮换与撤销能力。
- 产出：
  - `export type WebSessionCookie = { sessionId: string; secret: string }`
  - `export type WebSessionUser = Pick<users.$inferSelect, 'id' | 'username' | 'role' | 'status'>`
  - `export function formatWebSessionCookie(sessionId: string, secret: string): string`
  - `export function parseWebSessionCookie(raw: string | undefined): WebSessionCookie | null`
  - `export async function createWebSession(userId: number): Promise<{ session: MobileSessionSummary; cookieSecret: string }>`
  - `export async function verifyWebSessionCookie(raw: string | undefined): Promise<{ user: WebSessionUser; session: MobileSessionSummary; rotatedCookieSecret?: string } | null>`
  - `export async function upgradeLegacyWebJwt(token: string): Promise<{ session: MobileSessionSummary; cookieSecret: string } | null>`

`logAuthEvent()` 输出单行结构化 JSON 到 stdout，供部署侧日志系统聚合指标；不新增凭据表，也不把事件写入含明文 Cookie 的请求日志。

- [ ] **步骤 1：写 Cookie 编解码与哈希失败测试**

覆盖：

- Cookie 格式为 `sessionId.secret`。
- 非法空值、单段、超长值解析失败。
- 服务端只保存 secret 哈希，不保存明文。

- [ ] **步骤 2：写登录、验证、退出契约失败测试**

更新 `cookie-auth-hardening.test.mjs`，断言：

- `/login` 写入 HttpOnly、Secure、SameSite=Lax、Path=/ 的 `storing_session`。
- `/verify` 支持新 Cookie、有效旧 JWT 升级、无效凭据 401。
- `/logout` 删除 `storing_session`，兼容期同时删除 `storing_token`。
- 修改密码撤销 `web` 会话。
- CSRF 中间件认可两种 Cookie。
- `requireAuth()` 能识别新 Web Cookie。

- [ ] **步骤 3：运行测试确认失败**

```bash
cd apps/api
node --test test/web-session.service.test.ts test/cookie-auth-hardening.test.mjs test/unified-session-rotation.test.ts
```

- [ ] **步骤 4：实现 Web 会话服务**

实现要求：

- Web 会话填充 `device_id = session.id`、`device_name = 'Web 浏览器'`、`app_version = 'web'`。
- `refresh_token_hash` 存储 Cookie secret 哈希。
- 有效访问顺延空闲过期，但不超过绝对过期。
- 定期轮换 Cookie secret，并返回新的 Set-Cookie。
- 旧 JWT 校验通过后创建 `web` 会话并返回新 Cookie。

- [ ] **步骤 5：接入认证中间件与路由**

修改：

- `requireAuth`、`optionalAuth`、`requireAdmin` 支持 Web Cookie。
- `/login` 创建新 Web 会话。
- `/verify` 优先验证新 Cookie，再做旧 JWT 升级。
- `/logout` 删除新旧 Cookie 并撤销会话。
- 修改密码撤销 `web` 会话。
- CSRF 双 Cookie 兼容。

- [ ] **步骤 6：运行 API 相关测试与构建**

```bash
cd apps/api
node --test test/web-session.service.test.ts test/cookie-auth-hardening.test.mjs test/unified-session-rotation.test.ts test/mobile-auth-contract.test.mjs test/macos-auth-contract.test.mjs
pnpm build
```

- [ ] **步骤 7：提交**

```bash
git add apps/api/src/services/web-session.service.ts apps/api/src/middleware/auth.ts apps/api/src/routes/auth.ts apps/api/src/db/schema.ts apps/api/test/web-session.service.test.ts apps/api/test/cookie-auth-hardening.test.mjs apps/api/test/unified-session-rotation.test.ts
git commit -m "feat(api): Web 改用可撤销滑动数据库会话"
```

### 任务 4：认证错误码契约与 API 回归

**文件：**

- 修改：`apps/api/src/middleware/auth.ts`
- 修改：`apps/api/src/routes/auth.ts`
- 修改：`apps/api/src/services/mobile-session.service.ts`
- 修改：`apps/api/src/services/web-session.service.ts`
- 测试：`apps/api/test/auth-error-contract.test.mjs`
- 测试：`apps/api/test/security-hardening.test.mjs`

**接口：**

- 使用：现有 Hono JSON error shape。
- 产出：统一的 `error.code` 输出规则：`UNAUTHORIZED`、`INVALID_TOKEN`、`INVALID_REFRESH_TOKEN`、`SESSION_EXPIRED`、`SESSION_REVOKED`、`USER_DISABLED`、`LOGIN_RATE_LIMITED`。

- [ ] **步骤 1：写错误码矩阵失败测试**

覆盖缺少凭据、access token 过期、refresh token 过期、会话撤销、账号禁用、登录限流。每种场景断言 HTTP status、`error.code` 和中文用户提示。

- [ ] **步骤 2：运行测试确认失败**

```bash
cd apps/api
node --test test/auth-error-contract.test.mjs test/security-hardening.test.mjs
```

- [ ] **步骤 3：统一错误响应**

实现时不得改变旧客户端依赖的 `INVALID_REFRESH_TOKEN`、`USER_DISABLED`、`LOGIN_RATE_LIMITED` 含义。新增场景优先复用这些值，只有会话过期和撤销分别使用 `SESSION_EXPIRED`、`SESSION_REVOKED`。

- [ ] **步骤 4：运行 API 全量 Node 测试与构建**

```bash
cd apps/api
node --test test/*.test.mjs test/*.test.ts
pnpm build
```

- [ ] **步骤 5：提交**

```bash
git add apps/api/src/middleware/auth.ts apps/api/src/routes/auth.ts apps/api/src/services/mobile-session.service.ts apps/api/src/services/web-session.service.ts apps/api/test/auth-error-contract.test.mjs apps/api/test/security-hardening.test.mjs
git commit -m "feat(api): 统一认证错误码契约"
```

### 任务 5：Android 类型化认证协调器

**文件：**

- 创建：`apps/android/app/src/main/java/com/idickies/storing/auth/MobileAuthResult.kt`
- 创建：`apps/android/app/src/main/java/com/idickies/storing/auth/AuthFailureClassifier.kt`
- 修改：`apps/android/app/src/main/java/com/idickies/storing/auth/MobileSessionAuthenticator.kt`
- 修改：`apps/android/app/src/main/java/com/idickies/storing/auth/AuthRepository.kt`
- 修改：`apps/android/app/src/main/java/com/idickies/storing/auth/AuthViewModel.kt`
- 修改：`apps/android/app/src/main/java/com/idickies/storing/collect/CollectRepository.kt`
- 修改：`apps/android/app/src/main/java/com/idickies/storing/admin/AdminRepository.kt`
- 修改：`apps/android/app/src/main/java/com/idickies/storing/collect/WeChatImportRepository.kt`
- 测试：`apps/android/app/src/test/java/com/idickies/storing/auth/AuthRepositoryTest.kt`
- 测试：`apps/android/app/src/test/java/com/idickies/storing/auth/AuthFailureClassifierTest.kt`
- 测试：`apps/android/app/src/test/java/com/idickies/storing/collect/CollectRepositoryAuthenticationTest.kt`

**接口：**

- 使用：Retrofit `HttpException`、OkHttp `IOException`、现有 `SessionStore`。
- 产出：

```kotlin
sealed interface MobileAuthResult {
  data class Available(val user: MobileUser) : MobileAuthResult
  data object Offline : MobileAuthResult
  data object AuthenticationRequired : MobileAuthResult
  data object Forbidden : MobileAuthResult
}
```

`MobileSessionAuthenticator` 改为：

```kotlin
suspend fun ensureValidAccessToken(): MobileAuthResult
suspend fun refreshAccessToken(): MobileAuthResult
```

- 产出：`classifyAuthFailure(error: Throwable): MobileAuthResult`
- 产出：`class MobileNetworkUnavailableException : IOException`

- [ ] **步骤 1：写失败分类测试**

覆盖：

- `IOException`、timeout、UnknownHost 归类 Offline。
- 401 且 `INVALID_REFRESH_TOKEN`、`SESSION_EXPIRED` 归类 AuthenticationRequired。
- 403 且 `USER_DISABLED` 归类 Forbidden。
- 5xx 归类 Offline。
- 无法解析的 401 保守归类 AuthenticationRequired。

- [ ] **步骤 2：写 AuthRepository 状态与并发测试**

用假的 `MobileAuthApi`、`SessionStore` 覆盖：

- 网络异常后本地 refresh token 仍存在。
- 明确认证失效后本地会话清空。
- 账号禁用后本地会话保留。
- 并发 20 次 `refreshAccessToken()` 只调用一次 API。
- 迟到响应返回时，本地已更新的新 token 不被覆盖。
- access token 未过期时不刷新。

- [ ] **步骤 3：运行测试确认失败**

```bash
cd apps/android
./gradlew :app:testDebugUnitTest --tests 'com.idickies.storing.auth.*' --tests 'com.idickies.storing.collect.CollectRepositoryAuthenticationTest'
```

- [ ] **步骤 4：实现类型化刷新与互斥锁**

实现要求：

- `AuthRepository` 增加 `Mutex`。
- 刷新前记录旧 refresh token；写入新会话前确认本地仍是该旧 token。
- 只有 `AuthenticationRequired` 清空会话。
- `Offline` 与 `Forbidden` 保留会话。
- `restoreSession()` 返回 `MobileAuthResult`。
- UI 和仓库根据类型展示“网络暂不可用”“登录已失效”“账号已禁用”。

- [ ] **步骤 5：更新调用方并运行 Android 单测**

```bash
cd apps/android
./gradlew :app:testDebugUnitTest
```

- [ ] **步骤 6：提交**

```bash
git add apps/android/app/src/main/java/com/idickies/storing/auth apps/android/app/src/main/java/com/idickies/storing/collect/CollectRepository.kt apps/android/app/src/main/java/com/idickies/storing/admin/AdminRepository.kt apps/android/app/src/main/java/com/idickies/storing/collect/WeChatImportRepository.kt apps/android/app/src/test/java/com/idickies/storing/auth apps/android/app/src/test/java/com/idickies/storing/collect/CollectRepositoryAuthenticationTest.kt
git commit -m "feat(android): 类型化串行会话刷新与网络失败保留令牌"
```

### 任务 6：Android Worker 统一认证入口

**文件：**

- 修改：`apps/android/app/src/main/java/com/idickies/storing/collect/CollectTrackingWorker.kt`
- 修改：`apps/android/app/src/main/java/com/idickies/storing/collect/PendingCollectSubmissionWorker.kt`
- 修改：`apps/android/app/src/main/java/com/idickies/storing/di/AppModule.kt`
- 修改：`apps/android/app/src/main/java/com/idickies/storing/QiankunjieApplication.kt`
- 修改：`apps/android/app/build.gradle.kts`
- 修改：`apps/android/gradle/libs.versions.toml`
- 测试：`apps/android/app/src/test/java/com/idickies/storing/collect/CollectWorkerAuthenticationTest.kt`

**接口：**

- 使用：任务 5 的 `MobileSessionAuthenticator`。
- 产出：两个 Worker 通过 Hilt 注入同一个 `MobileSessionAuthenticator`，不再自行调用 `MobileAuthApi.refresh()`。

- [ ] **步骤 1：写 Worker 认证入口失败测试**

测试策略使用静态契约或抽取纯函数，断言：

- Worker 源码不再包含 `MobileRefreshRequest`。
- Worker 不再构造 `MobileAuthApi`。
- Worker 认证失败为 Offline 时返回 `Result.retry()`。
- 明确认证失效时不重复提交已排队任务，并保留本地队列待用户登录。
- 网络恢复后重新调度。

- [ ] **步骤 2：运行测试确认失败**

```bash
cd apps/android
./gradlew :app:testDebugUnitTest --tests 'com.idickies.storing.collect.CollectWorkerAuthenticationTest'
```

- [ ] **步骤 3：实现 Hilt Worker**

使用 `@HiltWorker` 与 `@AssistedInject`，并在应用 WorkManager 配置中启用 `HiltWorkerFactory`。两个 Worker 只负责业务请求与任务状态，认证统一交给任务 5 的协调器。

- [ ] **步骤 4：运行 Android 单测与 lint**

```bash
cd apps/android
./gradlew :app:testDebugUnitTest
./gradlew lint
```

- [ ] **步骤 5：提交**

```bash
git add apps/android/app/src/main/java/com/idickies/storing/collect apps/android/app/src/main/java/com/idickies/storing/di/AppModule.kt apps/android/app/src/main/java/com/idickies/storing/QiankunjieApplication.kt apps/android/app/src/test/java/com/idickies/storing/collect/CollectWorkerAuthenticationTest.kt
git add apps/android/app/build.gradle.kts apps/android/gradle/libs.versions.toml
git commit -m "refactor(android): 后台采集统一复用会话认证协调器"
```

### 任务 7：Android 采集未登录页内续跑

**文件：**

- 修改：`apps/android/app/src/main/java/com/idickies/storing/database/ArticleCacheDatabase.kt`
- 创建：`apps/android/app/src/main/java/com/idickies/storing/collect/PendingAuthAction.kt`
- 创建：`apps/android/app/src/main/java/com/idickies/storing/collect/PendingAuthActionDao.kt`
- 修改：`apps/android/app/src/main/java/com/idickies/storing/collect/ShareCollectViewModel.kt`
- 修改：`apps/android/app/src/main/java/com/idickies/storing/ShareReceiverActivity.kt`
- 修改：`apps/android/app/src/main/java/com/idickies/storing/ui/QiankunjieApp.kt`
- 测试：`apps/android/app/src/test/java/com/idickies/storing/collect/PendingAuthActionTest.kt`
- 测试：`apps/android/app/src/test/java/com/idickies/storing/collect/ShareCollectAuthResumeTest.kt`

**接口：**

- 使用：任务 5 的 `MobileAuthResult` 与 `MobileAuthenticationRequiredException`。
- 产出：

```kotlin
sealed interface PendingShareAction {
  data class CollectUrl(val url: String, val source: String) : PendingShareAction
  data class ImportFiles(val files: List<PendingAuthActionFile>) : PendingShareAction
}
```

Room 使用 `pending_auth_actions` 与 `pending_auth_action_files` 两张表保存一对多关系，不用 JSON 字符串内嵌文件列表。

- 产出：`ShareCollectUiState` 增加 `loginRequired: Boolean` 与 `pendingAction: PendingShareAction?`
- 产出：`fun submitAfterLogin()`

- [ ] **步骤 1：写待登录动作持久化测试**

覆盖：

- URL 动作保存 URL 与 source。
- 文件动作保存私有文件路径与显示名。
- 待登录动作在进程重建后可恢复。
- 成功后删除动作。
- 用户取消登录时动作保留。

- [ ] **步骤 2：写分享页续跑策略测试**

覆盖：

- 认证失败时不调用 `onFinished()`。
- 登录成功后 URL 自动重新提交一次。
- 登录成功后文件自动重新导入一次。
- 网络失败仍走现有离线队列文案。
- 登录取消不删除私有文件。

- [ ] **步骤 3：运行测试确认失败**

```bash
cd apps/android
./gradlew :app:testDebugUnitTest --tests 'com.idickies.storing.collect.PendingAuthActionTest' --tests 'com.idickies.storing.collect.ShareCollectAuthResumeTest'
```

- [ ] **步骤 4：实现数据库版本迁移与页内登录**

实现要求：

1. Room 数据库版本递增并迁移 `pending_auth_actions`、`pending_auth_action_files` 及索引。
2. content URI 在进入登录前已复制到应用私有目录。
3. 分享页内嵌登录 Bottom Sheet，不跳回主界面。
4. 登录成功后调用 `submitAfterLogin()`。
5. 提交成功后显示现有成功文案、任务 ID 或文章 ID。
6. 主界面登录成功后同样触发待处理动作。

- [ ] **步骤 5：运行 Android 全量单测与 Release 构建**

```bash
cd apps/android
./gradlew :app:testDebugUnitTest
./gradlew assembleRelease
```

若本地缺少正式签名环境，Release 构建失败必须记录具体缺失 Secret，并至少完成 `compileReleaseKotlin` 与 Release 资源编译验证。

- [ ] **步骤 6：提交**

```bash
git add apps/android/app/src/main/java/com/idickies/storing apps/android/app/src/test/java/com/idickies/storing/collect
git commit -m "feat(android): 采集登录后自动续跑原任务"
```

### 任务 8：macOS 会话存储与旧类型迁移

**文件：**

- 创建：`apps/macos/Packages/QiankunjieKit/Sources/QiankunjieAuth/MigratingSessionStore.swift`
- 修改：`apps/macos/Packages/QiankunjieKit/Sources/QiankunjieAuth/AuthRepository.swift`
- 修改：`apps/macos/Packages/QiankunjieKit/Sources/QiankunjieAuth/AuthModel.swift`
- 修改：`apps/api/src/services/mobile-session.service.ts`
- 修改：`apps/api/src/routes/auth.ts`
- 测试：`apps/macos/Packages/QiankunjieKit/Tests/QiankunjieAuthTests/MigratingSessionStoreTests.swift`
- 测试：`apps/macos/Packages/QiankunjieKit/Tests/QiankunjieAuthTests/AuthRepositoryTests.swift`
- 测试：`apps/api/test/macos-auth-contract.test.mjs`

**接口：**

- 使用：现有 `FileSessionStore`、`KeychainSessionStore`。
- 产出：

```swift
public protocol LegacySessionStore: SessionStore {
  func clearLegacy() async throws
}

public actor MigratingSessionStore: SessionStore {
  public init(primary: any SessionStore, legacy: any SessionStore)
  public func migrateIfNeeded() async throws -> SessionTokens?
  public func takeLegacyOrigin() async -> Bool
}
```

`MigratingSessionStore` 实现并导出 `LegacySessionStore`；`AuthRepository` 成功建立新会话后通过 `takeLegacyOrigin()` 判断并清理旧存储。

- API 产出：
  - `export async function migrateLegacyMacSession(refreshToken: string, device?: MobileDevice): Promise<MobileSessionRotation | null>`
  - `POST /macos/auth/migrate-legacy`

- [ ] **步骤 1：写存储迁移失败测试**

覆盖：

- 文件为空且 Keychain 有 token 时，token 写入文件并返回。
- 文件已有 token 时不读 Keychain。
- 网络刷新失败时 Keychain 与文件 token 均保留。
- 刷新成功后调用 `clearLegacy()`。
- 文件损坏但 Keychain 可读时可恢复。

- [ ] **步骤 2：写旧会话类型迁移失败测试**

API 测试覆盖：

- 有效旧 `android` 会话迁移为 `macos` 并轮换 token。
- 已撤销或过期旧会话返回 `INVALID_REFRESH_TOKEN`。
- 迁移接口写审计事件。
- 迁移后旧 token 进入宽限恢复逻辑。

- [ ] **步骤 3：运行测试确认失败**

```bash
cd apps/macos/Packages/QiankunjieKit
swift test --filter QiankunjieAuthTests
cd ../../../api
node --test test/macos-auth-contract.test.mjs
```

- [ ] **步骤 4：实现迁移**

实现要求：

- `AuthRepository` 默认使用 `MigratingSessionStore(primary: FileSessionStore(), legacy: KeychainSessionStore())`。
- 新 token 持久化成功后再清理 legacy。
- `/macos/auth/refresh` 明确无效时，客户端仅在本地标记来自旧版本存储的情况下尝试迁移接口。
- 迁移成功后更新内存与文件 token。
- 网络错误不尝试清会话。

- [ ] **步骤 5：运行 macOS 认证测试与 API 测试**

```bash
cd apps/macos/Packages/QiankunjieKit
swift test --filter QiankunjieAuthTests
cd ../../../api
node --test test/macos-auth-contract.test.mjs test/unified-session-rotation.test.ts
```

- [ ] **步骤 6：提交**

```bash
git add apps/macos/Packages/QiankunjieKit/Sources/QiankunjieAuth apps/macos/Packages/QiankunjieKit/Tests/QiankunjieAuthTests apps/api/src/services/mobile-session.service.ts apps/api/src/routes/auth.ts apps/api/test/macos-auth-contract.test.mjs
git commit -m "feat(macos): 自动迁移历史会话存储与客户端类型"
```

### 任务 9：macOS 离线状态与 QuickCollect 登录续跑

**文件：**

- 修改：`apps/macos/Packages/QiankunjieKit/Sources/QiankunjieAuth/AuthModel.swift`
- 修改：`apps/macos/QiankunjieMac/App/AppModel.swift`
- 修改：`apps/macos/QiankunjieMac/App/MenuBarController.swift`
- 修改：`apps/macos/QiankunjieMac/Features/Collect/QuickCollectPanel.swift`
- 修改：`apps/macos/QiankunjieMac/Features/Auth/LoginView.swift`
- 测试：`apps/macos/Packages/QiankunjieKit/Tests/QiankunjieAuthTests/AuthModelTests.swift`
- 测试：`apps/macos/QiankunjieMacTests/QuickCollectAuthResumeTests.swift`

**接口：**

- 使用：任务 8 的迁移结果与现有 `AuthRepository`。
- 产出：

```swift
public enum AuthBootState: Equatable {
  case loading
  case authenticated
  case offline
  case authenticationRequired
}
```

- 产出：QuickCollect 面板状态包含 `savedURL: String?`、`isLoginPresented: Bool`、`pendingSubmit: Bool`。

- [ ] **步骤 1：写启动状态失败测试**

覆盖：

- 网络错误返回 `offline`，不清本地 token。
- 明确认证失败返回 `authenticationRequired`，清本地 token。
- 恢复成功返回 `authenticated`。
- `offline` 不触发主界面登录弹窗。

- [ ] **步骤 2：写 QuickCollect 续跑失败测试**

覆盖：

- 未登录提交时保留 URL。
- 面板内登录成功后自动提交原 URL。
- 登录取消后 URL 保留。
- 提交成功后清理 pending 状态。
- 网络失败显示“网络连接失败，请稍后重试”，不清会话。

- [ ] **步骤 3：运行测试确认失败**

```bash
cd apps/macos/Packages/QiankunjieKit
swift test --filter QiankunjieAuthTests
cd ../..
"$(bash scripts/verify-xcode.sh --print-xcodegen-bin)" generate
xcodebuild -project Qiankunjie.xcodeproj -scheme QiankunjieMac -configuration Debug -destination 'platform=macOS,arch=arm64' CODE_SIGNING_ALLOWED=NO test
```

- [ ] **步骤 4：实现状态机与面板登录**

实现要求：

1. QuickCollect 面板内嵌登录 Sheet，不强制打开主窗口。
2. 登录视图接受 `onSuccess` 回调。
3. 登录成功后回填用户状态并自动重试原 URL。
4. 微信批次在认证恢复后调用现有 coordinator 重试。

- [ ] **步骤 5：运行完整 macOS 测试**

```bash
pnpm macos:test
```

- [ ] **步骤 6：提交**

```bash
git add apps/macos/Packages/QiankunjieKit/Sources/QiankunjieAuth apps/macos/QiankunjieMac/App apps/macos/QiankunjieMac/Features/Collect apps/macos/QiankunjieMac/Features/Auth apps/macos/Packages/QiankunjieKit/Tests/QiankunjieAuthTests apps/macos/QiankunjieMacTests/QuickCollectAuthResumeTests.swift
git commit -m "feat(macos): 采集面板页内登录并自动续跑"
```

### 任务 10：Web 启动状态机与慢网防误判

**文件：**

- 修改：`apps/web/src/lib/api.ts`
- 修改：`apps/web/src/components/providers/AuthContext.tsx`
- 修改：`apps/web/src/app/(main)/layout.tsx`
- 修改：`apps/web/src/app/page.tsx`
- 修改：`apps/web/src/components/layout/DesktopTopNav.tsx`
- 修改：`apps/web/src/components/layout/MobileTopNav.tsx`
- 测试：`apps/web/test/auth-session-resilience.test.mjs`
- 测试：`apps/web/test/auth-boot-state.test.mjs`

**接口：**

- 使用：任务 3 的 `/verify` 新 Cookie 与错误码。
- 产出：

```ts
export type AuthBootState =
  | { status: 'loading' }
  | { status: 'authenticated'; user: User }
  | { status: 'unauthenticated' }
  | { status: 'bootFailed'; retry: () => void };
```

`useAuth()` 继续提供 `user`、`isAuthenticated`、`isLoading` 兼容字段，并新增 `bootState`。

- 产出：`class ApiRequestError extends Error { status: number; errorCode?: string }`

- [ ] **步骤 1：写 API 错误解析失败测试**

覆盖：

- 401 解析为 `ApiRequestError`，status 401，errorCode 来自响应。
- 网络超时保留浏览器 AbortError 语义。
- 5xx 返回 `ApiRequestError`。

- [ ] **步骤 2：写认证启动状态失败测试**

覆盖：

- 请求中保持 loading。
- 401/403 进入 unauthenticated。
- 超时、断网、5xx 进入 bootFailed。
- 源码不再有 3 秒 `AUTH_BOOT_TIMEOUT_MS`。
- 私有路由仅在 unauthenticated 时跳转 `/published`。
- bootFailed 显示“网络暂时不可用，请重试”。
- 根路由在迁移期识别 `storing_token` 与 `storing_session` 任一 Cookie，避免新会话用户被误送到发布页。

- [ ] **步骤 3：运行测试确认失败**

```bash
cd apps/web
node --test test/auth-session-resilience.test.mjs test/auth-boot-state.test.mjs
```

- [ ] **步骤 4：实现状态机**

实现要求：

- 删除独立 3 秒启动超时。
- `/verify` 使用显式 10 秒超时。
- `bootFailed` 提供重试并保持当前路由。
- 顶栏在 bootFailed 下显示可重试状态，不显示“登录”成功态。

- [ ] **步骤 5：运行 Web 测试、lint、构建**

```bash
cd apps/web
node --test test/auth-session-resilience.test.mjs test/auth-boot-state.test.mjs
pnpm lint
pnpm build
```

- [ ] **步骤 6：提交**

```bash
git add apps/web/src/lib/api.ts apps/web/src/components/providers/AuthContext.tsx apps/web/src/app/(main)/layout.tsx apps/web/src/app/page.tsx apps/web/src/components/layout/DesktopTopNav.tsx apps/web/src/components/layout/MobileTopNav.tsx apps/web/test/auth-session-resilience.test.mjs apps/web/test/auth-boot-state.test.mjs
git commit -m "fix(web): 慢网启动不再误判登录失效"
```

### 任务 11：跨端集成验证与发布准备

**文件：**

- 修改：`docs/superpowers/specs/2026-10-07-unified-auth-session-design.md`（仅追加验证记录）
- 创建：`docs/superpowers/plans/2026-10-07-unified-auth-session-verification.md`

**接口：**

- 使用：任务 1-10 的全部产物。
- 产出：一份包含命令、结果、未尽事项和发布顺序的验证记录。

- [ ] **步骤 1：运行 API 全量验证**

```bash
cd apps/api
node --test test/*.test.mjs test/*.test.ts
pnpm build
```

- [ ] **步骤 2：运行 Web 全量验证**

```bash
cd apps/web
node --test test/*.mjs
pnpm lint
pnpm build
```

- [ ] **步骤 3：运行 Android 全量验证**

```bash
cd apps/android
./gradlew :app:testDebugUnitTest
./gradlew lint
./gradlew assembleRelease
```

Release 签名缺失时，记录缺失 Secret 并运行 `compileReleaseKotlin`；不得宣称正式 APK 验证完成。

- [ ] **步骤 4：运行 macOS 全量与 Release 验证**

```bash
pnpm macos:test
bash apps/macos/scripts/build-dmg.sh
```

- [ ] **步骤 5：本地端到端手测**

必须记录日期、构建版本、步骤和结果：

1. 部署本地 API 与 Web。
2. Web 旧 `storing_token` 打开首页，确认自动升级为新 Cookie 且不重新登录。
3. Web 开发者工具模拟慢网，确认私有路由不跳发布页。
4. Android 断网启动，确认不清 token；恢复网络后自动恢复。
5. Android 分享 URL 在未登录时页内登录，登录后出现采集任务。
6. Android 分享文件在未登录时页内登录，登录后文章导入成功。
7. macOS 清空文件会话但保留旧 Keychain token，启动后自动迁移。
8. macOS QuickCollect 未登录时输入 URL，面板内登录后自动提交。
9. 修改密码后确认三端旧会话均失效。
10. 服务端日志抽查确认无 token、Cookie、密码。

- [ ] **步骤 6：验证兼容端与数据库迁移**

```bash
pnpm --filter browser-extension test
pnpm --filter browser-extension lint
```

并在本地数据库副本或 staging 数据库执行迁移，记录：

- 迁移前备份位置。
- `absolute_expires_at` 回填行数。
- 空值残留数为 0。
- 迁移前后 Android、macOS、浏览器扩展、Web 会话数量。
- 迁移耗时。

- [ ] **步骤 7：写验证记录**

记录必须区分“已证实”“未验证”“受阻原因”。禁止把编译通过写成端到端通过。

- [ ] **步骤 8：提交**

```bash
git add docs/superpowers/specs/2026-10-07-unified-auth-session-design.md docs/superpowers/plans/2026-10-07-unified-auth-session-verification.md
git commit -m "test: 记录三端统一认证验证结果"
```

### 任务 12：合并前审查与发布顺序确认

**文件：**

- 无新增产品文件，审查当前分支全部变更。

**接口：**

- 使用任务 1-11 的提交与验证记录。
- 产出：合并与部署顺序清单。

- [ ] **步骤 1：检查分支状态**

```bash
git status --short --branch
git log --oneline origin/master..HEAD
```

- [ ] **步骤 2：运行仓库级验证**

```bash
pnpm lint
pnpm build
```

- [ ] **步骤 3：审查安全边界**

逐项确认：

- 数据库无明文 refresh token 或 Cookie secret。
- 日志无敏感凭据。
- 新 Cookie HttpOnly、Secure、SameSite、Path 正确。
- CSRF 双 Cookie 兼容按预期。
- 旧错误码未改变含义。
- 旧 Web JWT 与旧 Mac 会话迁移均有兼容期控制。

- [ ] **步骤 4：确认发布顺序**

发布顺序固定为：

1. API 兼容版本。
2. Web。
3. Android。
4. macOS。

任何一步未验证通过，不进入下一步。

- [ ] **步骤 5：提交可能的审查修正**

如审查产生修正，按内容单独提交；无修正则不产生空提交。

### 任务 13：兼容期结束后的清理

**触发条件：**

- 此任务不得与任务 1-12 放在同一发布批次执行。
- 必须在生产观察至少 30 天后执行。
- 必须确认旧 Web JWT 升级次数为 0 且旧 Mac 会话迁移次数为 0 持续 7 天以上。
- 必须确认 Android 与 macOS 目标版本覆盖率满足发布要求。

**文件：**

- 修改：`apps/api/src/routes/auth.ts`
- 修改：`apps/api/src/middleware/auth.ts`
- 修改：`apps/api/src/services/web-session.service.ts`
- 修改：`apps/web/src/app/page.tsx`
- 测试：`apps/api/test/cookie-auth-hardening.test.mjs`
- 测试：`apps/api/test/macos-auth-contract.test.mjs`
- 测试：`apps/web/test/auth-boot-state.test.mjs`

**接口：**

- 使用：任务 1-12 的兼容实现与生产观察数据。
- 产出：移除旧 `storing_token` JWT 升级、旧 Mac 会话迁移入口和 CSRF 双 Cookie 兼容。

- [ ] **步骤 1：写兼容清理失败测试**

覆盖：

- `/verify` 不再接受旧 `storing_token` 换新会话。
- Web 根路由只识别 `storing_session`。
- CSRF 只认可 `storing_session`。
- `/macos/auth/migrate-legacy` 返回 404。
- 现有新会话访问不受影响。

- [ ] **步骤 2：实现清理**

删除兼容分支与过期接口，保留统一会话路径。不得删除仍被新客户端使用的错误码。

- [ ] **步骤 3：运行验证**

```bash
cd apps/api
node --test test/cookie-auth-hardening.test.mjs test/macos-auth-contract.test.mjs
pnpm build
cd ../web
node --test test/auth-boot-state.test.mjs
pnpm lint
pnpm build
```

- [ ] **步骤 4：提交**

```bash
git add apps/api/src/routes/auth.ts apps/api/src/middleware/auth.ts apps/api/src/services/web-session.service.ts apps/web/src/app/page.tsx apps/api/test/cookie-auth-hardening.test.mjs apps/api/test/macos-auth-contract.test.mjs apps/web/test/auth-boot-state.test.mjs
git commit -m "chore(api): 移除认证会话迁移兼容逻辑"
```

## 执行说明

- 本计划必须按任务顺序执行。任务 1-4 是服务端基础；任务 5-9 依赖这些接口；任务 10 依赖任务 3；任务 11-12 必须最后执行；任务 13 必须在满足生产观察条件后另分支执行。
- 执行过程中如果发现设计文档与代码事实冲突，先停止修改，更新设计文档并获得确认后再继续。
- 不允许把网络异常归类为认证失效。
- 不允许在采集登录流程中丢失用户已提交的 URL 或文件。
- 不允许因迁移失败删除旧存储中的 token。
- 每个任务的“预期失败”必须真实运行并记录，不得只凭实现推断。
