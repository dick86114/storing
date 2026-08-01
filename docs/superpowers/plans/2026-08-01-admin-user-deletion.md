# 管理员删除用户 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为管理员提供安全的永久删除用户能力，并在 Android 管理后台形成接口、状态和二次确认交互闭环。

**Architecture:** 在 API 的 `authRoutes` 中新增管理员专用 `DELETE /admin/users/:id`。该路由先执行角色与自身保护，再用数据库事务清理目标用户私有记录、匿名化可保留的历史记录并写入删除审计日志。Android 通过 Retrofit、`AdminRepository` 和 `AdminViewModel` 调用该契约；`AdminScreen` 将删除入口限制在非管理员账号的编辑弹窗中，并使用输入用户名的二次确认阻止误删。

**Tech Stack:** Hono、Drizzle ORM、PostgreSQL、Node.js `node:test`、Kotlin、Retrofit、Hilt、Jetpack Compose、JUnit4、Gradle。

## 全局约束

- 仅已登录的管理员可以删除用户。
- 不能删除当前登录用户，不能删除任意 `admin` 角色账号。
- 所有用户私有清理与匿名化操作必须处于同一数据库事务；失败必须回滚。
- 不删除共享的 `articles` 表及任何其他用户的 `article_metadata`。
- Android 请求必须继续复用 `AdminRepository.authenticatedRequest`：请求前校验 token，401 后最多刷新并重试一次。
- Android 删除前必须输入完整目标用户名；删除中禁用重复提交。
- 本轮按用户既有要求保留本地改动：**不提交、不推送**。
- 项目注释、文档和用户可见文案全部使用中文；前端相关命令使用 `pnpm`，不得使用 `npm`。

---

## 文件结构与职责

- `apps/api/src/routes/auth.ts`：定义删除路由、权限校验、事务清理、审计写入和标准响应。
- `apps/api/test/admin-user-deletion.test.mjs`：静态契约测试，锁定路由、保护规则、事务清理和共享文章保留边界。
- `apps/android/app/src/main/java/com/idickies/storing/admin/AdminModels.kt`：声明删除接口响应与清理统计的序列化模型。
- `apps/android/app/src/main/java/com/idickies/storing/admin/AdminApi.kt`：声明 Retrofit `DELETE admin/users/{id}` 调用。
- `apps/android/app/src/main/java/com/idickies/storing/admin/AdminRepository.kt`：将删除调用置于既有管理员鉴权重试边界内。
- `apps/android/app/src/main/java/com/idickies/storing/admin/AdminViewModel.kt`：负责提交状态、成功移除列表项、刷新管理数据和错误回滚。
- `apps/android/app/src/main/java/com/idickies/storing/ui/AdminScreen.kt`：提供受保护删除入口、用户名确认弹窗和删除结果反馈。
- `apps/android/app/src/test/java/com/idickies/storing/admin/AdminRepositoryAuthenticationTest.kt`：证明删除请求走鉴权重试边界。
- `apps/android/app/src/test/java/com/idickies/storing/admin/AdminUserDeletionModelTest.kt`：验证删除响应 JSON 序列化。
- `apps/android/app/src/test/java/com/idickies/storing/ui/AdminUserDeletionPresentationTest.kt`：验证管理员没有删除入口，以及确认文案和确认条件。

---

### Task 1：锁定后端删除契约与安全边界

**Files:**
- Create: `apps/api/test/admin-user-deletion.test.mjs`
- Modify: `apps/api/src/routes/auth.ts`

**Interfaces:**
- Consumes: `requireAdmin`、`getCurrentUser(c)`、Drizzle 表 `users`、`articleMetadata`、`collectJobs`、`mobileSessions`、`mcpClients`、`mcpRequestLogs`、`adminAuditLogs`、`writeAdminAudit`。
- Produces: `DELETE /admin/users/:id`，成功响应 `{ deleted, user_id, username, cleanup }`。

- [ ] **Step 1：写出失败的 API 契约测试**

创建 `apps/api/test/admin-user-deletion.test.mjs`，先断言当前尚不存在的删除路由、保护错误码和事务边界：

```js
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('管理员删除用户接口受管理员权限与账号保护约束', () => {
  const routes = read('src/routes/auth.ts');

  assert.match(routes, /authRoutes\.delete\('\/admin\/users\/:id', requireAdmin/);
  assert.match(routes, /SELF_DELETE_FORBIDDEN/);
  assert.match(routes, /ADMIN_DELETE_FORBIDDEN/);
  assert.match(routes, /USER_NOT_FOUND/);
});

test('管理员删除用户在事务内清理私有数据并保留共享文章', () => {
  const routes = read('src/routes/auth.ts');

  assert.match(routes, /await db\.transaction\(async \(tx\) =>/);
  assert.match(routes, /tx\.delete\(articleMetadata\)\.where\(eq\(articleMetadata\.userId, id\)\)/);
  assert.match(routes, /tx\.delete\(collectJobs\)\.where\(eq\(collectJobs\.userId, id\)\)/);
  assert.match(routes, /tx\.delete\(mobileSessions\)\.where\(eq\(mobileSessions\.userId, id\)\)/);
  assert.match(routes, /tx\.delete\(users\)\.where\(eq\(users\.id, id\)\)/);
  assert.doesNotMatch(routes, /tx\.delete\(articles\)/);
});
```

- [ ] **Step 2：运行测试并确认红灯**

运行：

```bash
cd apps/api && node --test test/admin-user-deletion.test.mjs
```

预期：失败，指出 `DELETE /admin/users/:id` 或所需保护/事务代码尚不存在。

- [ ] **Step 3：在 `auth.ts` 最小实现删除路由**

1. 扩展 Drizzle schema 导入，加入 `mobileSessions`、`collectJobs` 和 `mcpRequestLogs`。
2. 在现有 `PATCH /admin/users/:id` 后新增路由：解析有限整数 `id`，加载目标用户并获取 `currentUser`。
3. 依序返回 400、404、409：无效 ID、用户不存在、删除自身、删除管理员。
4. 在 `db.transaction` 中：
   - 获取 `articleMetadata`、`collectJobs`、`mobileSessions`、`mcpClients`、`mcpRequestLogs`、`adminAuditLogs` 的待清理数量；
   - 找出目标用户拥有的 MCP client ID；
   - 先将相关 `mcpRequestLogs.userId` 与相关 `clientId` 置为 `null`；
   - 将既有 `adminAuditLogs.targetUserId` 置为 `null`，保留并扩展 `detail` 中的 `deleted_user_id`、`deleted_username`；
   - 删除 `articleMetadata`、`collectJobs`、`mobileSessions`、`mcpClients`；
   - 最后删除 `users`；
   - 使用 `writeAdminAudit` 的等价事务内插入方式写入 `user_deleted`，其 `actorUserId` 是当前管理员、`targetUserId` 为 `null`、详情包含目标用户快照和清理统计。
5. 事务提交后返回设计说明中的成功响应。绝不删除 `articles`。

- [ ] **Step 4：运行测试并确认绿灯**

运行：

```bash
cd apps/api && node --test test/admin-user-deletion.test.mjs
```

预期：全部通过。

- [ ] **Step 5：运行相邻管理员路由回归测试**

运行：

```bash
cd apps/api && node --test test/admin-library-audit.test.mjs test/phase4-mcp-admin-management.test.mjs
```

预期：全部通过，证明现有审计和 MCP 管理契约未被破坏。

---

### Task 2：补齐 Android 网络模型与鉴权仓库测试

**Files:**
- Create: `apps/android/app/src/test/java/com/idickies/storing/admin/AdminUserDeletionModelTest.kt`
- Modify: `apps/android/app/src/main/java/com/idickies/storing/admin/AdminModels.kt`
- Modify: `apps/android/app/src/main/java/com/idickies/storing/admin/AdminApi.kt`
- Modify: `apps/android/app/src/main/java/com/idickies/storing/admin/AdminRepository.kt`
- Modify: `apps/android/app/src/test/java/com/idickies/storing/admin/AdminRepositoryAuthenticationTest.kt`

**Interfaces:**
- Consumes: API 成功体 `{ deleted, user_id, username, cleanup }`。
- Produces: `AdminDeleteUserResponse`、`AdminUserCleanupSummary`、`AdminApi.deleteUser(id)`、`AdminRepository.deleteUser(id)`。

- [ ] **Step 1：先写响应 JSON 序列化失败测试**

在 `AdminUserDeletionModelTest.kt` 使用工程现有 Kotlinx Serialization `Json` 配置解码：

```kotlin
@Test
fun `删除用户响应会解码用户快照和清理统计`() {
  val result = json.decodeFromString<AdminDeleteUserResponse>(
    """{"deleted":true,"user_id":42,"username":"reader","cleanup":{"article_metadata":12,"collect_jobs":3,"mobile_sessions":2,"mcp_clients":1,"mcp_request_logs_anonymized":9,"admin_audit_logs_anonymized":4}}""",
  )

  assertTrue(result.deleted)
  assertEquals(42, result.userId)
  assertEquals("reader", result.username)
  assertEquals(12, result.cleanup.articleMetadata)
  assertEquals(4, result.cleanup.adminAuditLogsAnonymized)
}
```

- [ ] **Step 2：运行单测并确认红灯**

运行：

```bash
ANDROID_HOME=/opt/homebrew/share/android-commandlinetools ANDROID_SDK_ROOT=/opt/homebrew/share/android-commandlinetools apps/android/gradlew -p apps/android testDebugUnitTest --tests com.idickies.storing.admin.AdminUserDeletionModelTest
```

预期：编译失败，提示 `AdminDeleteUserResponse` 尚未定义。

- [ ] **Step 3：实现模型、Retrofit 与仓库方法**

在 `AdminModels.kt` 新增：

```kotlin
@Serializable
data class AdminUserCleanupSummary(
  @SerialName("article_metadata") val articleMetadata: Int = 0,
  @SerialName("collect_jobs") val collectJobs: Int = 0,
  @SerialName("mobile_sessions") val mobileSessions: Int = 0,
  @SerialName("mcp_clients") val mcpClients: Int = 0,
  @SerialName("mcp_request_logs_anonymized") val mcpRequestLogsAnonymized: Int = 0,
  @SerialName("admin_audit_logs_anonymized") val adminAuditLogsAnonymized: Int = 0,
)

@Serializable
data class AdminDeleteUserResponse(
  val deleted: Boolean,
  @SerialName("user_id") val userId: Int,
  val username: String,
  val cleanup: AdminUserCleanupSummary,
)
```

在 `AdminApi.kt` 新增：

```kotlin
@DELETE("admin/users/{id}")
suspend fun deleteUser(@Path("id") id: Int): AdminDeleteUserResponse
```

在 `AdminRepository.kt` 新增：

```kotlin
suspend fun deleteUser(id: Int) = authenticatedRequest { api.deleteUser(id) }
```

- [ ] **Step 4：扩展现有仓库鉴权测试并确认绿灯**

在 `AdminRepositoryAuthenticationTest.kt` 的 `FakeAdminApi` 加入删除计数与返回值，并增加：

```kotlin
@Test
fun `删除用户在 401 后只刷新并重试一次`() = runBlocking {
  val auth = FakeAuthenticator(ensureResult = true, refreshResult = true)
  val api = FakeAdminApi(deleteErrors = ArrayDeque(listOf(http401())))
  val repository = AdminRepository(api, auth)

  val result = repository.deleteUser(42)

  assertTrue(result.deleted)
  assertEquals(1, auth.refreshCalls)
  assertEquals(2, api.deleteUserCalls)
}
```

运行：

```bash
ANDROID_HOME=/opt/homebrew/share/android-commandlinetools ANDROID_SDK_ROOT=/opt/homebrew/share/android-commandlinetools apps/android/gradlew -p apps/android testDebugUnitTest --tests 'com.idickies.storing.admin.*'
```

预期：新增模型测试和既有管理员仓库测试全部通过。

---

### Task 3：实现 Android ViewModel 删除状态与可回归单测

**Files:**
- Modify: `apps/android/app/src/main/java/com/idickies/storing/admin/AdminViewModel.kt`
- Create: `apps/android/app/src/test/java/com/idickies/storing/admin/AdminUserDeletionViewModelTest.kt`

**Interfaces:**
- Consumes: `AdminRepository.deleteUser(id): AdminDeleteUserResponse`。
- Produces: `AdminViewModel.deleteUser(id)`；成功时移除用户并设置一次性成功提示，失败时保留用户与错误。

- [ ] **Step 1：写出 ViewModel 行为失败测试**

为 `AdminRepository` 抽出最小可注入删除依赖，或给 `AdminViewModel` 提供可测试构造入口。测试覆盖：

```kotlin
@Test
fun `删除成功后立即从用户列表移除并公布成功提示`() = runTest {
  val viewModel = createViewModel(users = listOf(user(7, "reader")), deleteResult = deletedUser(7, "reader"))

  viewModel.deleteUser(7)
  advanceUntilIdle()

  assertTrue(viewModel.state.value.users.none { it.id == 7 })
  assertEquals("已永久删除用户「reader」", viewModel.state.value.notice)
  assertFalse(viewModel.state.value.submitting)
}

@Test
fun `删除失败后保留用户列表并恢复提交状态`() = runTest {
  val viewModel = createViewModel(users = listOf(user(7, "reader")), deleteError = IllegalStateException("HTTP 409"))

  viewModel.deleteUser(7)
  advanceUntilIdle()

  assertEquals(listOf(user(7, "reader")), viewModel.state.value.users)
  assertEquals("HTTP 409", viewModel.state.value.error)
  assertFalse(viewModel.state.value.submitting)
}
```

- [ ] **Step 2：运行测试并确认红灯**

运行：

```bash
ANDROID_HOME=/opt/homebrew/share/android-commandlinetools ANDROID_SDK_ROOT=/opt/homebrew/share/android-commandlinetools apps/android/gradlew -p apps/android testDebugUnitTest --tests com.idickies.storing.admin.AdminUserDeletionViewModelTest
```

预期：失败，提示 `deleteUser` 或 `notice` 尚不存在。

- [ ] **Step 3：实现最小 ViewModel 状态更新**

1. 在 `AdminUiState` 加入 `notice: String? = null`。
2. 新增 `fun deleteUser(id: Int)`：若 `submitting` 直接返回；否则设置 `submitting=true`、清空 `error` 和 `notice`。
3. 调用 `repository.deleteUser(id)`；成功时从 `users` 剔除 `response.userId`，设置 `notice = "已永久删除用户「${response.username}」"`，并通过既有 `load()` 同步审计和 MCP 标签页数据。
4. 失败时仅设置 `error`，保留用户列表，并把 `submitting=false`。
5. 新增 `clearNotice()`，供 UI 在显示后消费。

- [ ] **Step 4：运行测试并确认绿灯**

运行：

```bash
ANDROID_HOME=/opt/homebrew/share/android-commandlinetools ANDROID_SDK_ROOT=/opt/homebrew/share/android-commandlinetools apps/android/gradlew -p apps/android testDebugUnitTest --tests com.idickies.storing.admin.AdminUserDeletionViewModelTest
```

预期：两个删除状态测试通过。

---

### Task 4：完成 Android 删除入口和双重确认展示

**Files:**
- Modify: `apps/android/app/src/main/java/com/idickies/storing/ui/AdminScreen.kt`
- Create: `apps/android/app/src/test/java/com/idickies/storing/ui/AdminUserDeletionPresentationTest.kt`

**Interfaces:**
- Consumes: `AdminViewModel.deleteUser(id)`、`AdminUiState.notice`、编辑用户 `AdminUser`。
- Produces: `canDeleteAdminUser(user, currentSubmitting)`、`adminUserDeletionPresentation(user)`，以及 `DeleteUserDialog`。

- [ ] **Step 1：写出展示规则失败测试**

将可测试的展示规则抽为顶级 `internal` 函数和数据类，并先断言：

```kotlin
@Test
fun `管理员账号没有删除入口`() {
  assertFalse(canDeleteAdminUser(AdminUser(id = 1, username = "admin", role = "admin", status = "active")))
}

@Test
fun `普通用户删除确认要求完整用户名`() {
  val presentation = adminUserDeletionPresentation(AdminUser(id = 7, username = "reader", role = "user", status = "active"))

  assertEquals("永久删除用户", presentation.title)
  assertEquals("reader", presentation.requiredConfirmation)
  assertTrue(presentation.warning.contains("不可恢复"))
}
```

- [ ] **Step 2：运行测试并确认红灯**

运行：

```bash
ANDROID_HOME=/opt/homebrew/share/android-commandlinetools ANDROID_SDK_ROOT=/opt/homebrew/share/android-commandlinetools apps/android/gradlew -p apps/android testDebugUnitTest --tests com.idickies.storing.ui.AdminUserDeletionPresentationTest
```

预期：失败，提示展示规则尚未定义。

- [ ] **Step 3：实现编辑弹窗入口和删除确认框**

1. 在 `AdminScreen` 保留 `pendingDeletionUser: AdminUser?` 状态。
2. 将 `EditUserDialog` 增加 `onRequestDelete` 参数；仅当 `canDeleteAdminUser(user)` 时展示 `DeleteOutline` 图标加“删除用户”的红色 `OutlinedButton`。
3. 点击入口时关闭编辑弹窗并设置 `pendingDeletionUser`。
4. 新增 `DeleteUserDialog`：
   - 标题为“永久删除用户”；
   - 文本包含目标用户名、会清理“资料库内容、采集任务、设备登录和 MCP 连接”、以及“不可恢复”；
   - `OutlinedTextField` 要求完整用户名匹配；
   - 只有 `confirmation.trim() == user.username`、且未 `submitting` 才启用红色“永久删除”；
   - 删除中将输入框、取消和确认按钮禁用，确认按钮显示 `CircularProgressIndicator` 或“删除中”；
   - 成功时通过 `notice` 关闭弹窗；失败时保持弹窗和输入。
5. 使用现有错误展示区域显示 `state.error`，并在 `state.notice` 非空时显示成功提示后调用 `clearNotice()`。

- [ ] **Step 4：运行展示规则测试并确认绿灯**

运行：

```bash
ANDROID_HOME=/opt/homebrew/share/android-commandlinetools ANDROID_SDK_ROOT=/opt/homebrew/share/android-commandlinetools apps/android/gradlew -p apps/android testDebugUnitTest --tests com.idickies.storing.ui.AdminUserDeletionPresentationTest
```

预期：展示规则测试通过。

- [ ] **Step 5：运行 Android 管理后台完整单测**

运行：

```bash
ANDROID_HOME=/opt/homebrew/share/android-commandlinetools ANDROID_SDK_ROOT=/opt/homebrew/share/android-commandlinetools apps/android/gradlew -p apps/android testDebugUnitTest --tests 'com.idickies.storing.admin.*' --tests 'com.idickies.storing.ui.AdminUserDeletionPresentationTest'
```

预期：全部通过。

---

### Task 5：端到端构建与本地交付验证

**Files:**
- Modify: 上述实现和测试文件。
- Create: `/Users/dickies/Documents/workspaces/storing/output/android/乾坤戒-v0.7.0-admin-user-deletion-test-20260801.apk`

**Interfaces:**
- Consumes: 已通过的 API 契约与 Android 单元测试。
- Produces: 可安装的本地 Debug APK；无格式错误的本地改动。

- [ ] **Step 1：运行 API 删除用户和相邻管理员测试集**

运行：

```bash
cd apps/api && node --test test/admin-user-deletion.test.mjs test/admin-library-audit.test.mjs test/phase4-mcp-admin-management.test.mjs && pnpm build
```

预期：测试与 TypeScript 构建成功。

- [ ] **Step 2：运行 Android 全量 Debug 单元测试**

运行：

```bash
ANDROID_HOME=/opt/homebrew/share/android-commandlinetools ANDROID_SDK_ROOT=/opt/homebrew/share/android-commandlinetools apps/android/gradlew -p apps/android testDebugUnitTest
```

预期：全部通过。

- [ ] **Step 3：构建新的 Debug APK 并复制到输出目录**

运行：

```bash
ANDROID_HOME=/opt/homebrew/share/android-commandlinetools ANDROID_SDK_ROOT=/opt/homebrew/share/android-commandlinetools apps/android/gradlew -p apps/android assembleDebug
mkdir -p output/android
cp apps/android/app/build/outputs/apk/debug/*.apk output/android/乾坤戒-v0.7.0-admin-user-deletion-test-20260801.apk
```

预期：输出目录中存在新的可安装 APK。

- [ ] **Step 4：检查改动边界且不提交、不推送**

运行：

```bash
git diff --check
git status --short
```

预期：没有空白符错误；仅包含本计划列出的代码、测试、设计文档和计划文档改动；不执行 `git add`、`git commit` 或 `git push`。
