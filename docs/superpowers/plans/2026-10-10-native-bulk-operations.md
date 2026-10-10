# Native Bulk Operations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Android 和 macOS 文章列表中接入既有服务端批量 API，提供选择、确认、执行、部分结果展示和 ZIP/Obsidian 导出。

**Architecture:** Android 扩展现有多选模式和 `LibraryViewModel`，新增 Retrofit 契约与状态归一器。macOS 在 `QiankunjieLibrary` 增加批量契约、选择模型和网络方法，再由 `LibraryToolbar` 和文章卡片消费。两端都只调用服务端批量端点，不循环单篇接口。

**Tech Stack:** Kotlin、Jetpack Compose、Retrofit、Kotlinx Serialization、OkHttp、Hilt；Swift、SwiftUI、Observation、URLSession、Testing。

**Spec:** [docs/superpowers/specs/2026-10-10-native-bulk-operations-design.md](../specs/2026-10-10-native-bulk-operations-design.md)

## Global Constraints

- 单次批量最多 200 个正整数文章 ID。
- 所有动作必须先确认；普通删除和彻底删除使用危险样式与强提示。
- 批量动作必须展示成功、跳过、失败数量；不得把部分失败包装成整体成功。
- Android 不提供批量 Obsidian 导出。
- macOS 额外提供批量 Obsidian 导出。
- Android ZIP 使用当前会话凭证下载并保存到系统下载位置。
- macOS ZIP 使用认证请求下载，通过 `NSSavePanel` 保存。
- 运行中的动作禁止重复提交和退出批量模式。
- 全部用户可见文案使用中文。

## Review Focus

- 超过 200 篇或包含非法 ID：客户端必须在提交前拒绝，不产生部分请求；由 Task 1 与 Task 7 的校验测试覆盖。
- 部分成功：服务端返回成功、跳过、失败时，UI 必须分别计数并保留失败明细；由 Task 3 与 Task 8 的结果映射测试覆盖。
- 动作与视图不匹配：例如归档页出现取消归档之外的状态动作，或已发布页出现归档动作；由 Task 5 与 Task 9 的动作可见性测试覆盖。
- 失效选择：刷新、分页或删除后，选择集不得保留已消失文章；由 Task 4 与 Task 8 的选择清理测试覆盖。
- 批量 Obsidian 单篇失败：不得中断整批，结果必须标明失败文章；由 Task 11 的导出服务测试覆盖。

---

## File Structure

Android：

- `apps/android/app/src/main/java/com/idickies/storing/library/BulkArticleOperations.kt`：动作枚举、视图动作策略、选择与结果归一。
- `apps/android/app/src/main/java/com/idickies/storing/library/ArticleModels.kt`：批量请求和响应模型。
- `apps/android/app/src/main/java/com/idickies/storing/network/ArticleApi.kt`：Retrofit 批量端点。
- `apps/android/app/src/main/java/com/idickies/storing/library/ArticleRepository.kt`：类型化批量方法。
- `apps/android/app/src/main/java/com/idickies/storing/library/BulkExportDownloader.kt`：认证下载与 MediaStore 保存。
- `apps/android/app/src/main/java/com/idickies/storing/library/LibraryViewModel.kt`：批量状态与编排。
- `apps/android/app/src/main/java/com/idickies/storing/ui/components/BulkActionBar.kt`：可复用批量栏、动作菜单和确认/结果弹窗。

macOS：

- `apps/macos/Packages/QiankunjieKit/Sources/QiankunjieLibrary/BulkArticleModels.swift`：批量契约和结果模型。
- `apps/macos/Packages/QiankunjieKit/Sources/QiankunjieLibrary/BulkArticlePolicy.swift`：动作可见性、ID 校验和选择策略。
- `apps/macos/Packages/QiankunjieKit/Sources/QiankunjieLibrary/LibraryRepository.swift`：类型化批量网络方法。
- `apps/macos/Packages/QiankunjieKit/Sources/QiankunjieLibrary/LibraryModel.swift`：多选状态和批量编排。
- `apps/macos/QiankunjieMac/Features/Library/LibraryToolbar.swift`：批量模式切换、动作菜单和确认入口。
- `apps/macos/QiankunjieMac/Features/Library/CompactArticleListView.swift`：卡片选择态。
- `apps/macos/QiankunjieMac/Features/Library/BulkArticleExportService.swift`：ZIP 下载与 Obsidian 批量导出。

### Task 1: Android 批量域模型与动作策略

**Files:**

- Create: `apps/android/app/src/main/java/com/idickies/storing/library/BulkArticleOperations.kt`
- Test: `apps/android/app/src/test/java/com/idickies/storing/library/BulkArticleOperationsTest.kt`

**Interfaces:**

- Produces:
  - `enum class BulkArticleAction(val apiValue: String) : Serializable`
  - `enum class BulkToolbarAction {
    Favorite
    Unfavorite
    Archive
    Unarchive
    Delete
    PermanentDelete
    Publish
    Unpublish
    SetCategory
    ReclassifyCategory
    GenerateAi
    ExportZip
  }`
  - `fun bulkToolbarActions(for view: LibraryView): List<BulkToolbarAction>`
  - `fun validatedBulkArticleIds(ids: Collection<Int>): List<Int>`
  - `const val BULK_ARTICLE_ACTION_LIMIT = 200`

- [ ] **Step 1: Write the failing test**

Add tests `批量动作按视图收敛`、`超过200篇或非法ID会被拒绝`、`Android不包含批量Obsidian动作`。

```kotlin
assertFalse(bulkToolbarActions(LibraryView.Inbox).contains(BulkToolbarAction.Unpublish))
assertFalse(BulkToolbarAction.entries.any { it.name == "BulkObsidian" })
assertFailsWith<IllegalArgumentException> { validatedBulkArticleIds((1..201).toList()) }
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/android && ./gradlew testDebugUnitTest --tests "com.idickies.storing.library.BulkArticleOperationsTest"`

Expected: FAIL，类型和函数不存在。

- [ ] **Step 3: Implement enum, action policy and ID validation**

动作 API 值必须与服务端一致：`favorite`、`unfavorite`、`archive`、`unarchive`、`delete`、`permanent_delete`、`publish`、`unpublish`。重复 ID 去重，非正整数抛出 `IllegalArgumentException`。

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/android && ./gradlew testDebugUnitTest --tests "com.idickies.storing.library.BulkArticleOperationsTest"`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add apps/android/app/src/main/java/com/idickies/storing/library/BulkArticleOperations.kt apps/android/app/src/test/java/com/idickies/storing/library/BulkArticleOperationsTest.kt
git commit -m "feat(android): add bulk action policy"
```

### Task 2: Android API 契约与 Repository

**Files:**

- Modify: `apps/android/app/src/main/java/com/idickies/storing/library/ArticleModels.kt`
- Modify: `apps/android/app/src/main/java/com/idickies/storing/network/ArticleApi.kt`
- Modify: `apps/android/app/src/main/java/com/idickies/storing/library/ArticleRepository.kt`
- Test: `apps/android/app/src/test/java/com/idickies/storing/library/ArticleBulkModelsTest.kt`

**Interfaces:**

- Consumes: Task 1 的 `BulkArticleAction` 与 `BulkToolbarAction`。
- Produces:
  - `data class ArticleBulkActionRequest(val action: BulkArticleAction, val articleIds: List<Int>)`
  - `data class ArticleBulkIssue(val articleId: Int, val code: String, val message: String? = null)`
  - `data class ArticleBulkActionResult(...)`
  - `data class ArticleBulkAiResult(...)`
  - `data class ArticleBulkExportJob(...)`
  - `data class ArticlePublicationLink(val articleId: Int, val publicUrl: String)`
  - Repository:
    - `suspend fun bulkAction(action: BulkArticleAction, articleIds: List<Int>): ArticleBulkActionResult`
    - `suspend fun bulkCategory(articleIds: List<Int>, categoryId: Int): ArticleBulkActionResult`
    - `suspend fun bulkRegenerateAi(articleIds: List<Int>, includeCategory: Boolean): ArticleBulkAiResult`
    - `suspend fun createBulkExport(articleIds: List<Int>): ArticleBulkExportJob`
    - `suspend fun bulkExport(jobId: Int): ArticleBulkExportJob`

- [ ] **Step 1: Write the failing serialization test**

Add tests `批量动作请求序列化为服务端契约`、`部分成功响应解码为统一结果`、`导出任务状态可解码`。断言请求 JSON 包含 `"action":"favorite"` 和 `"articleIds":[1,2]`；响应可解码 `succeededIds`、`skipped`、`failed`、`publications`。

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/android && ./gradlew testDebugUnitTest --tests "com.idickies.storing.library.ArticleBulkModelsTest"`

Expected: FAIL，模型不存在。

- [ ] **Step 3: Implement models and endpoints**

字段名使用 `@SerialName` 对齐服务端蛇形命名。`ArticleBulkExportRequest` 固定 `format = "zip"`、`includeAi = true`、`organizeByCategory = true`。`bulk-category` 响应类型从 `updatedCount` 改为统一结果结构。Android 的旧 `bulk-classify` 调用点迁移到 `bulk-regenerate-ai`，不再保留两套批量重判语义。

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/android && ./gradlew testDebugUnitTest --tests "com.idickies.storing.library.ArticleBulkModelsTest"`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add apps/android/app/src/main/java/com/idickies/storing/library/ArticleModels.kt apps/android/app/src/main/java/com/idickies/storing/network/ArticleApi.kt apps/android/app/src/main/java/com/idickies/storing/library/ArticleRepository.kt apps/android/app/src/test/java/com/idickies/storing/library/ArticleBulkModelsTest.kt
git commit -m "feat(android): add bulk operation contracts"
```

### Task 3: Android 结果归一与选择状态

**Files:**

- Modify: `apps/android/app/src/main/java/com/idickies/storing/library/BulkArticleOperations.kt`
- Test: `apps/android/app/src/test/java/com/idickies/storing/library/NativeBulkResultTest.kt`

**Interfaces:**

- Consumes: Task 2 的 `ArticleBulkActionResult`、`ArticleBulkAiResult`。
- Produces:
  - `data class NativeBulkResult(val requestedCount: Int, val succeededCount: Int, val skippedCount: Int, val issues: List<ArticleBulkIssue>, val publications: List<ArticlePublicationLink>)`
  - `fun NativeBulkResult.Companion.from(result: ArticleBulkActionResult): NativeBulkResult`
  - `fun NativeBulkResult.Companion.from(result: ArticleBulkAiResult): NativeBulkResult`
  - `fun removeBulkSelection(selected: Set<Int>, succeededIds: Collection<Int>): Set<Int>`
  - `fun removeMissingBulkSelection(selected: Set<Int>, availableIds: Collection<Int>): Set<Int>`

- [ ] **Step 1: Write the failing test**

Add tests `普通动作归一部分结果`、`AI结果把排队计入成功`、`删除成功项从选择集移除`、`刷新时清理失效选择`。

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/android && ./gradlew testDebugUnitTest --tests "com.idickies.storing.library.NativeBulkResultTest"`

Expected: FAIL，类型或函数不存在。

- [ ] **Step 3: Implement result and selection reducers**

普通动作成功数取 `succeededIds.size`；AI 成功数取 `queuedIds.size`，`alreadyQueuedIds` 计入跳过。错误明细保留原文顺序。

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/android && ./gradlew testDebugUnitTest --tests "com.idickies.storing.library.NativeBulkResultTest"`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add apps/android/app/src/main/java/com/idickies/storing/library/BulkArticleOperations.kt apps/android/app/src/test/java/com/idickies/storing/library/NativeBulkResultTest.kt
git commit -m "feat(android): normalize bulk results"
```

### Task 4: Android 批量下载器

**Files:**

- Create: `apps/android/app/src/main/java/com/idickies/storing/library/BulkExportDownloader.kt`
- Modify: `apps/android/app/src/main/java/com/idickies/storing/di/AppModule.kt`
- Test: `apps/android/app/src/test/java/com/idickies/storing/library/BulkExportFileNameTest.kt`

**Interfaces:**

- Consumes: Task 2 的 `ArticleBulkExportJob`、现有 `OkHttpClient`、`ApiConfiguration.baseUrl`。
- Produces:
  - `interface BulkExportDownloader { suspend fun download(job: ArticleBulkExportJob): Uri }`
  - `class MediaStoreBulkExportDownloader @Inject constructor(...)`。

- [ ] **Step 1: Write the failing file-name test**

Add test `下载文件名包含任务ID且不含路径分隔符`。纯函数签名：

```kotlin
internal fun bulkExportFileName(job: ArticleBulkExportJob): String
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/android && ./gradlew testDebugUnitTest --tests "com.idickies.storing.library.BulkExportFileNameTest"`

Expected: FAIL。

- [ ] **Step 3: Implement MediaStore downloader**

下载 URL 使用 `job.downloadUrl` 与 API base URL 拼接；请求复用现有 `OkHttpClient`，自动携带认证和客户端头。写入 `MediaStore.Downloads`，MIME 为 `application/zip`，完成后发出系统通知。HTTP 或写入失败抛出中文错误。

- [ ] **Step 4: Run focused tests and compile**

Run: `cd apps/android && ./gradlew testDebugUnitTest compileDebugKotlin`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add apps/android/app/src/main/java/com/idickies/storing/library/BulkExportDownloader.kt apps/android/app/src/main/java/com/idickies/storing/di/AppModule.kt apps/android/app/src/test/java/com/idickies/storing/library/BulkExportFileNameTest.kt
git commit -m "feat(android): download bulk export archives"
```

### Task 5: Android ViewModel 与批量操作 UI

**Files:**

- Modify: `apps/android/app/src/main/java/com/idickies/storing/library/LibraryViewModel.kt`
- Modify: `apps/android/app/src/main/java/com/idickies/storing/ui/LibraryScreen.kt`
- Modify: `apps/android/app/src/main/java/com/idickies/storing/library/BulkArticleOperations.kt`
- Create: `apps/android/app/src/main/java/com/idickies/storing/ui/components/BulkActionBar.kt`
- Test: `apps/android/app/src/test/java/com/idickies/storing/library/BulkConfirmationCopyTest.kt`
- Test: `apps/android/app/src/test/java/com/idickies/storing/library/BulkUiStateReducerTest.kt`

**Interfaces:**

- Consumes: Task 1-4 的全部类型。
- Produces:
  - `LibraryUiState` 新增 `bulkRunningAction: BulkToolbarAction?`、`bulkResult: NativeBulkResult?`、`bulkExportJob: ArticleBulkExportJob?`、`bulkExportDownloading: Boolean`。
  - `LibraryViewModel.runBulkToolbarAction(action: BulkToolbarAction, ids: Set<Int>)`
  - `LibraryViewModel.runBulkCategory(ids: Set<Int>, categoryId: Int)`
  - `LibraryViewModel.clearBulkResult()`
  - Composable `AndroidBulkActionBar(...)`。

- [ ] **Step 1: Write the failing confirmation and reducer tests**

Add `所有批量动作都有中文确认文案`，断言 `BulkToolbarAction.entries` 均有非空标题和说明，删除与彻底删除标记为危险动作。Add `运行中的动作禁止再次执行`、`整体失败保留上下文`、`部分成功写入结果并保留选择集`。

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/android && ./gradlew testDebugUnitTest --tests "com.idickies.storing.library.BulkConfirmationCopyTest"`

Expected: FAIL。

- [ ] **Step 3: Implement ViewModel orchestration**

新增纯函数 `BulkUiStateReducer.apply(current, event)` 覆盖运行开始、部分成功、整体失败和导出状态；统一入口先校验 1..200 篇和当前运行状态；普通动作调用 `bulkAction`，设置分类调用 `bulkCategory`，重判分类调用 `bulkRegenerateAi(includeCategory = true)`，AI 调用 `bulkRegenerateAi(includeCategory = false)`，导出创建任务后启动轮询。成功后刷新当前列表、计数和归档分类；删除与彻底删除先移除成功 ID 再刷新。整体请求失败显示中文错误，部分成功显示结果弹窗。

- [ ] **Step 4: Implement reusable action bar and dialogs**

复用 `DropdownMenu` 与 `QiankunjieAlertDialog`。批量栏包含已选数量、全选、反选、「批量操作」下拉和退出。每个菜单项只负责打开确认弹窗；确认按钮才调用 ViewModel。设置分类确认后打开现有分类选择器。

- [ ] **Step 5: Replace archive-only batch UI**

把四个视图的工具栏接入同一 `AndroidBulkActionBar`。收件箱、收藏、归档和已发布的动作列表由 Task 1 策略决定。

- [ ] **Step 6: Run tests and build**

Run: `cd apps/android && ./gradlew testDebugUnitTest lintDebug assembleDebug`

Expected: PASS。

- [ ] **Step 7: Commit**

```bash
git add apps/android/app/src/main/java/com/idickies/storing apps/android/app/src/test/java/com/idickies/storing/library
git commit -m "feat(android): add native bulk operations"
```

### Task 6: Android 回归与 Release 验证

**Files:**

- Modify: 只允许修改 Task 1-5 引入的相关文件。

**Interfaces:**

- Consumes: Task 1-5 全部交付物。
- Produces: 可合并的 Android 里程碑。

- [ ] **Step 1: Run Android unit tests and lint**

Run: `cd apps/android && ./gradlew testDebugUnitTest lintDebug`

Expected: PASS。

- [ ] **Step 2: Build Release APK**

Run: `cd apps/android && ./gradlew assembleRelease`

Expected: PASS；若签名变量未配置，记录失败原因并改用 `bundleDebug` 后继续 UI 验收，但最终交付前必须补 Release 验证。

- [ ] **Step 3: Manual smoke test**

在 Debug 包验证四个视图的动作菜单、确认弹窗、批量删除确认、导出 ZIP 和结果明细。

- [ ] **Step 4: Commit fixes if needed**

```bash
git add apps/android
git commit -m "fix(android): verify bulk operations"
```

If nothing changed, skip this commit.

### Task 7: macOS 批量契约、策略与网络层

**Files:**

- Create: `apps/macos/Packages/QiankunjieKit/Sources/QiankunjieLibrary/BulkArticleModels.swift`
- Create: `apps/macos/Packages/QiankunjieKit/Sources/QiankunjieLibrary/BulkArticlePolicy.swift`
- Modify: `apps/macos/Packages/QiankunjieKit/Sources/QiankunjieLibrary/LibraryRepository.swift`
- Test: `apps/macos/Packages/QiankunjieKit/Tests/QiankunjieLibraryTests/BulkArticlePolicyTests.swift`
- Test: `apps/macos/Packages/QiankunjieKit/Tests/QiankunjieLibraryTests/LibraryBulkRequestTests.swift`

**Interfaces:**

- Produces:
  - `public enum ArticleBulkAction: String, CaseIterable, Sendable`
  - `public enum BulkToolbarAction: CaseIterable, Sendable` including `setCategory`, `reclassify`, `generateAI`, `exportZIP`, `bulkObsidian`
  - `public struct ArticleBulkIssue: Codable, Hashable, Sendable`
  - `public struct ArticleBulkActionResult: Codable, Hashable, Sendable`
  - `public struct ArticleBulkAiResult: Codable, Hashable, Sendable`
  - `public struct NativeBulkResult: Equatable, Sendable`
  - `public struct ArticleBulkExportJob: Codable, Hashable, Sendable`
  - `public enum BulkArticlePolicy.toolbarActions(for: LibraryView) -> [BulkToolbarAction]`
  - `public enum BulkArticlePolicy.validatedIDs(_ ids: [Int]) throws -> [Int]`
  - `public protocol LibraryBulkOperating: Sendable`
  - `extension LibraryRepository: LibraryBulkOperating`

- [ ] **Step 1: Write failing policy tests**

Add tests `各视图批量动作与设计一致`、`超过200篇抛出无效输入`、`macOS包含批量Obsidian动作`。`bulkObsidian` 只存在于 `BulkToolbarAction`，不进入 `ArticleBulkAction`，也不发送到 `bulk-actions`。

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm macos:test`

Expected: FAIL，策略类型不存在。

- [ ] **Step 3: Implement Codable models, policy and API requests**

API 方法：

```swift
func bulkAction(_ action: ArticleBulkAction, articleIDs: [Int]) async throws -> ArticleBulkActionResult
func bulkCategory(articleIDs: [Int], categoryID: Int) async throws -> ArticleBulkActionResult
func bulkRegenerateAI(articleIDs: [Int], includeCategory: Bool) async throws -> ArticleBulkAiResult
func createBulkExport(articleIDs: [Int]) async throws -> ArticleBulkExportJob
func bulkExport(jobID: Int) async throws -> ArticleBulkExportJob
```

请求体由 `JSONEncoder.qiankunjie` 生成，路径和字段名与 Web 契约一致。`bulkObsidian` 不实现为服务端请求。

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm macos:test`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add apps/macos/Packages/QiankunjieKit/Sources/QiankunjieLibrary apps/macos/Packages/QiankunjieKit/Tests/QiankunjieLibraryTests
git commit -m "feat(macos): add bulk library contracts"
```

### Task 8: macOS 选择模型与批量编排

**Files:**

- Modify: `apps/macos/Packages/QiankunjieKit/Sources/QiankunjieLibrary/LibraryModel.swift`
- Test: `apps/macos/Packages/QiankunjieKit/Tests/QiankunjieLibraryTests/LibraryBulkModelTests.swift`

**Interfaces:**

- Consumes: Task 7 的 `LibraryBulkOperating`。
- Produces:
  - `public var isBulkSelecting: Bool`
  - `public private(set) var bulkSelection: Set<Int>`
  - `public private(set) var bulkRunningAction: BulkToolbarAction?`
  - `public private(set) var bulkResult: NativeBulkResult?`
  - `public func toggleBulkMode()`
  - `public func toggleBulkSelection(_ articleID: Int)`
  - `public func selectAllLoadedForBulk()`
  - `public func invertBulkSelection()`
  - `public func runBulkToolbarAction(_ action: BulkToolbarAction) async`
  - `public func runBulkCategory(_ categoryID: Int) async`

- [ ] **Step 1: Write failing selection and orchestration tests**

Add tests `批量模式选择跨分页保留`、`列表刷新清理失效选择`、`部分成功更新列表和结果`、`运行中禁止重复提交`、`删除成功项从列表和选择集移除`。使用符合 `LibraryBulkOperating` 的 fake。

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm macos:test`

Expected: FAIL，属性和方法不存在。

- [ ] **Step 3: Implement model state and orchestration**

`LibraryModel` 增加可注入 `bulkRepository: any LibraryBulkOperating`，默认使用 `LibraryRepository()`。普通动作成功后调用现有 `load(reset: false)` 保持分页内容，再刷新计数和分类；删除/彻底删除先移除成功 ID。AI 成功后刷新列表让队列状态可见。所有错误保留选择集并写入 `bulkResult` 或现有错误状态。

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm macos:test`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add apps/macos/Packages/QiankunjieKit/Sources/QiankunjieLibrary/LibraryModel.swift apps/macos/Packages/QiankunjieKit/Tests/QiankunjieLibraryTests/LibraryBulkModelTests.swift
git commit -m "feat(macos): orchestrate bulk selections"
```

### Task 9: macOS 批量工具栏、确认与结果 UI

**Files:**

- Modify: `apps/macos/QiankunjieMac/Features/Library/LibraryToolbar.swift`
- Modify: `apps/macos/QiankunjieMac/Features/Library/CompactArticleListView.swift`
- Test: `apps/macos/QiankunjieMacTests/LibraryBulkToolbarPolicyTests.swift`

**Interfaces:**

- Consumes: Task 8 的 `LibraryModel` 状态。
- Produces:
  - `enum BulkToolbarPolicy`
  - `static func canExit(bulkRunningAction: BulkToolbarAction?) -> Bool`
  - `static func confirmation(for action: BulkToolbarAction, selectedCount: Int) -> BulkConfirmationCopy`

- [ ] **Step 1: Write failing policy test**

Add tests `所有动作都有确认文案`、`删除和彻底删除是危险动作`、`运行中禁止退出`。

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm macos:test`

Expected: FAIL。

- [ ] **Step 3: Implement toolbar and selection UI**

非批量模式显示「批量操作」。批量模式显示已选数量、全选、反选、「批量操作」系统菜单和「退出」。菜单使用当前 `LibraryView` 的动作列表；设置分类显示可用分类子菜单；批量 Obsidian 显示在菜单末尾。卡片主体点击在批量模式下调用 `toggleBulkSelection`。

- [ ] **Step 4: Implement system confirmations and result alert**

所有动作先使用 `.confirmationDialog` 确认；删除和彻底删除使用 `role: .destructive`。结果使用 `.alert`，内容包含成功、跳过、失败数量和失败明细。导出任务未完成时显示进度；完成后提供保存。

- [ ] **Step 5: Run tests and app tests**

Run: `pnpm macos:test`

Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add apps/macos/QiankunjieMac/Features/Library apps/macos/QiankunjieMacTests/LibraryBulkToolbarPolicyTests.swift
git commit -m "feat(macos): add bulk operation interface"
```

### Task 10: macOS ZIP 导出下载

**Files:**

- Create: `apps/macos/QiankunjieMac/Features/Library/BulkArticleExportService.swift`
- Test: `apps/macos/QiankunjieMacTests/BulkExportArchiveNameTests.swift`

**Interfaces:**

- Consumes: Task 7 的 `ArticleBulkExportJob`、现有 `APIClient` / token provider。
- Produces:
  - `struct BulkArticleExportService`
  - `func poll(jobID: Int) async throws -> ArticleBulkExportJob`
  - `func save(_ job: ArticleBulkExportJob) async throws -> URL`

- [ ] **Step 1: Write failing archive-name test**

纯函数：

```swift
static func archiveName(for job: ArticleBulkExportJob) -> String
```

断言返回 `storing-export-<jobID>.zip` 且不包含路径分隔符。

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm macos:test`

Expected: FAIL。

- [ ] **Step 3: Implement polling and authenticated save**

轮询间隔 1.5 秒；`queued` / `running` 继续轮询，`failed` 抛出中文错误。下载使用当前 token provider 附加 `Authorization`。`NSSavePanel` 默认文件名由纯函数生成，成功后可调用 `NSWorkspace.shared.activateFileViewerSelecting([url])`。

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm macos:test`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add apps/macos/QiankunjieMac/Features/Library/BulkArticleExportService.swift apps/macos/QiankunjieMacTests/BulkExportArchiveNameTests.swift
git commit -m "feat(macos): save bulk export archives"
```

### Task 11: macOS 批量 Obsidian 导出

**Files:**

- Create: `apps/macos/QiankunjieMac/Features/Library/BulkObsidianExportService.swift`
- Test: `apps/macos/QiankunjieMacTests/BulkObsidianExportServiceTests.swift`

**Interfaces:**

- Consumes: 现有 `ObsidianArticleExporter`、`ObsidianExportSettingsStore`、`ArticleDetail`。
- Produces:
  - `struct BulkObsidianExportFailure: Equatable, Sendable`
  - `struct BulkObsidianExportSummary: Equatable, Sendable`
  - `struct BulkObsidianExportService`
  - `func export(articleIDs: [Int]) async throws -> BulkObsidianExportSummary`

- [ ] **Step 1: Write failing batch export test**

使用注入的 detail loader 和临时目录导出器 fake，验证：

```swift
summary.succeededIDs == [1, 3]
summary.failures.first?.articleID == 2
summary.failures.first?.message == "测试失败"
```

单篇抛错不得阻止后续文章。

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm macos:test`

Expected: FAIL。

- [ ] **Step 3: Implement sequential export and summary**

按选择顺序逐篇加载 `ArticleDetail`，转换为现有导出文档并调用 `ObsidianArticleExporter`。未配置目录时先抛出可操作错误。每篇失败记录文章 ID 和中文原因；全部完成后返回摘要。

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm macos:test`

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add apps/macos/QiankunjieMac/Features/Library/BulkObsidianExportService.swift apps/macos/QiankunjieMacTests/BulkObsidianExportServiceTests.swift
git commit -m "feat(macos): export selected articles to obsidian"
```

### Task 12: macOS 回归与 Release 验证

**Files:**

- Modify: 只允许修改 Task 7-11 引入的相关文件。

**Interfaces:**

- Consumes: Task 7-11 全部交付物。
- Produces: 可合并的 macOS 里程碑。

- [ ] **Step 1: Run full macOS tests**

Run: `pnpm macos:test`

Expected: PASS。

- [ ] **Step 2: Build Release app**

Run: `xcodebuild -project apps/macos/Qiankunjie.xcodeproj -scheme QiankunjieMac -configuration Release -destination 'platform=macOS' -derivedDataPath apps/macos/.derivedData build`

Expected: PASS。

- [ ] **Step 3: Manual smoke test**

验证四个视图的动作菜单、确认弹窗、批量删除确认、ZIP 下载和批量 Obsidian。至少覆盖一次部分失败结果。

- [ ] **Step 4: Commit fixes if needed**

```bash
git add apps/macos
git commit -m "fix(macos): verify bulk operations"
```

If nothing changed, skip this commit.
