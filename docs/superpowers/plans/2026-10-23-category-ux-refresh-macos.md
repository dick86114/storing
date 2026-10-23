# 分类体验重构 macOS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成分类体验重构的 macOS P0：侧栏分类导航、统一分类选择器、上下文内快速创建，以及轻量分类管理页。

**Architecture:** 在 macOS App 层新增唯一的 `CategoryCatalogModel`，统一持有启用/停用分类、文章计数、最近使用和分类变更操作。侧栏、工具栏、阅读器、批量选择器和管理页都消费该模型；文章归属仍通过现有 `LibraryModel`、`ReaderModel` 和分类 API 完成。

**Tech Stack:** Swift 6.4、SwiftUI、Observation、Swift Testing、Xcode 27、现有 `ManagementAPIClient`/`APIClient`、UserDefaults、UI Lab。

**Spec:** `docs/superpowers/specs/2026-10-23-category-ux-refresh-design.md`

## Global Constraints

- 本计划只实现 macOS 阶段一；Android 和 Web 在 macOS 验收后另写计划。
- 所有新增注释、测试名、界面文案和文档使用中文。
- 不新增数据库表，不修改分类归属和归档业务语义。
- 分类只用于归档文章；“待整理”是系统分类，不可编辑、停用或删除。
- 新建分类默认只需要名称；说明、收录示例、排除示例和颜色属于可选高级规则。
- 最近使用最多 5 个，按用户、按设备保存在本机，不跨设备同步。
- 最近使用使用 UserDefaults key `category.recents.<userID>`，值类型为 `[Int]`。
- 开启中的分类在使用处按 `sortOrder` 升序、再按 `id` 升序展示。
- 分类目录只有一个共享数据源：macOS App 层的 `CategoryCatalogModel`。
- 所有用户可见状态必须覆盖加载、空态、网络失败、重复名称、部分成功和用户切换。
- 使用 `pnpm` 执行项目命令；不要修改或提交现有未跟踪的 `artifacts/`。

## Review Focus

- 用户切换时仍有分类请求在途：旧用户的分类、计数和最近使用不能写入新用户。
- 输入与现有分类同名的内容：不能创建重复分类，也不能丢失当前文章或批量上下文。
- 创建分类成功但文章分配失败：分类必须保留，选择器必须明确提示部分完成。
- 选择器打开期间分类被删除或停用：提交必须失败可恢复，侧栏和最近使用必须同步清理。
- 侧栏分类选择、归档视图和工具栏筛选必须始终指向同一个 `categoryId`，不能出现两个入口显示不同分类。

---

## File Structure

### 新增

- `apps/macos/QiankunjieMac/Features/Categories/CategoryModels.swift`
  - 分类草稿、预设色、颜色策略、分类分配结果和展示辅助类型。
- `apps/macos/QiankunjieMac/Features/Categories/CategoryCatalogService.swift`
  - 可测试的分类目录网络协议及 `ManagementAPIClient` 适配器。
- `apps/macos/QiankunjieMac/Features/Categories/CategoryCatalogModel.swift`
  - 唯一分类目录状态、变更操作和用户作用域。
- `apps/macos/QiankunjieMac/Features/Categories/CategoryRecentStore.swift`
  - 按用户保存最近使用分类。
- `apps/macos/QiankunjieMac/Features/Categories/CategoryPickerModel.swift`
  - 搜索、最近使用、重复名称、创建并分类和部分成功状态机。
- `apps/macos/QiankunjieMac/Features/Categories/CategoryPickerContent.swift`
  - 单篇、归档和批量共用的分类选择器界面。
- `apps/macos/QiankunjieMac/Features/Categories/CategoryQuickCreateView.swift`
  - 名称优先、详细规则折叠的轻量创建表单。
- `apps/macos/QiankunjieMac/Features/Categories/SidebarArchiveCategoryGroup.swift`
  - 侧栏“归档”展开组、分类行、新建和管理入口。
- `apps/macos/QiankunjieMac/Features/Settings/CategoryManagementModel.swift`
  - 管理页展示状态，委托 `CategoryCatalogModel` 完成数据变更。

### 修改

- `apps/macos/QiankunjieMac/App/AppModel.swift`
  - 持有 `categoryCatalog` 和 `selectedCategoryID`，同步登录、退出和侧栏选择。
- `apps/macos/QiankunjieMac/App/SidebarView.swift`
  - 用 `SidebarArchiveCategoryGroup` 替换单独的归档行。
- `apps/macos/QiankunjieMac/App/RootWindow.swift`
  - 把分类目录和导航状态传给资料库、阅读器与管理页。
- `apps/macos/QiankunjieMac/Features/Reader/ReaderPaneView.swift`
  - 单篇分类改用锚定 Popover，归档分类继续使用 Sheet，共用分类选择器。
- `apps/macos/Packages/QiankunjieKit/Sources/QiankunjieReader/ReaderModel.swift`
  - 移除阅读器自己的分类目录加载和创建职责。
- `apps/macos/QiankunjieMac/Features/Library/CompactArticleListView.swift`
  - 注入共享分类目录和侧栏分类选择回调。
- `apps/macos/QiankunjieMac/Features/Library/LibraryToolbar.swift`
  - 分类筛选和批量分类改用共享分类目录。
- `apps/macos/QiankunjieMac/Features/Library/BulkCategorySelectionSheet.swift`
  - 包装共享 `CategoryPickerContent`。
- `apps/macos/Packages/QiankunjieKit/Sources/QiankunjieLibrary/LibraryModel.swift`
  - 移除分类目录所有权；分类分配改为接收 `ArticleCategory`。
- `apps/macos/QiankunjieMac/Features/Settings/CategoryManagementView.swift`
  - 改为“列表 + 详情”，使用共享目录和轻量创建表单。
- `apps/macos/QiankunjieMac/Features/Settings/CategoryEditorOverlay.swift`
  - 保留完整规则编辑，改由管理模型/共享目录驱动。
- `apps/macos/QiankunjieMac/UILab/UILabFixtures.swift`
  - 增加分类目录夹具和固定分类数据。
- `apps/macos/QiankunjieMac/UILab/UILabScenario.swift`
  - 增加分类选择器和管理页场景。
- `apps/macos/scripts/macos-ui-lab.sh`
  - 注册新 UI Lab 场景。
- `docs/MacOS-UI-Lab.md`
  - 增加场景、截图路径和人工验收项。

### 新增测试

- `apps/macos/QiankunjieMacTests/CategoryCatalogModelTests.swift`
- `apps/macos/QiankunjieMacTests/CategoryRecentStoreTests.swift`
- `apps/macos/QiankunjieMacTests/CategoryPickerModelTests.swift`
- `apps/macos/QiankunjieMacTests/CategoryNavigationTests.swift`
- `apps/macos/QiankunjieMacTests/CategoryQuickCreatePolicyTests.swift`
- `apps/macos/QiankunjieMacTests/CategoryManagementModelTests.swift`

### 修改测试

- `apps/macos/QiankunjieMacTests/AppModelTests.swift`
- `apps/macos/QiankunjieMacTests/CollectWiringTests.swift`
- `apps/macos/QiankunjieMacTests/ReaderCategoryEditorTests.swift`
- `apps/macos/QiankunjieMacTests/CategoryEditorSheetTests.swift`
- `apps/macos/QiankunjieMacTests/UILabTests.swift`
- `apps/macos/Packages/QiankunjieKit/Tests/QiankunjieReaderTests/ReaderModelTests.swift`
- `apps/macos/Packages/QiankunjieKit/Tests/QiankunjieLibraryTests/LibraryModelTests.swift`

---

### Task 1: 分类目录与最近使用基础设施

**Files:**

- Create: `apps/macos/QiankunjieMac/Features/Categories/CategoryModels.swift`
- Create: `apps/macos/QiankunjieMac/Features/Categories/CategoryCatalogService.swift`
- Create: `apps/macos/QiankunjieMac/Features/Categories/CategoryCatalogModel.swift`
- Create: `apps/macos/QiankunjieMac/Features/Categories/CategoryRecentStore.swift`
- Test: `apps/macos/QiankunjieMacTests/CategoryCatalogModelTests.swift`
- Test: `apps/macos/QiankunjieMacTests/CategoryRecentStoreTests.swift`

**Interfaces:**

- Consumes: `ArticleCategory`、`CategoriesResponse`、`CategoryMutationRequest`、`ManagementAPIClient`。
- Produces:

```swift
enum CategoryAssignmentOutcome: Equatable, Sendable {
    case success(succeededCount: Int, skippedCount: Int)
    case partial(succeededCount: Int, skippedCount: Int, failedCount: Int, message: String)
    case failure(message: String)
}
```

```swift
protocol CategoryCatalogServicing: Sendable {
    func list(includeInactive: Bool) async throws -> CategoriesResponse
    func create(_ request: CategoryMutationRequest) async throws -> CategoryResponse
    func update(categoryID: Int, request: CategoryMutationRequest) async throws -> CategoryResponse
    func reorder(categoryIDs: [Int]) async throws -> CategoryReorderResponse
    func delete(categoryID: Int, targetCategoryID: Int) async throws -> DeleteCategoryResponse
    func merge(sourceCategoryID: Int, targetCategoryID: Int) async throws
    func optimize(_ request: CategoryOptimizeRequest) async throws -> CategoryOptimizeResponse
}
```

```swift
@MainActor
final class CategoryCatalogModel: Observable {
    private(set) var categories: [ArticleCategory]
    private(set) var counts: [Int: Int]
    private(set) var recentCategoryIDs: [Int]
    private(set) var isLoading: Bool
    private(set) var isMutating: Bool
    private(set) var errorMessage: String?
    var userID: Int?
    var onCategoriesChanged: (@MainActor () -> Void)?

    var activeCategories: [ArticleCategory] { get }
    var recentCategories: [ArticleCategory] { get }

    init(service: any CategoryCatalogServicing, recentStore: any CategoryRecentStoring)
    func prepareUser(userID: Int?)
    func load() async
    func create(_ draft: CategoryDraft) async throws -> ArticleCategory
    func update(_ category: ArticleCategory, draft: CategoryDraft) async throws -> ArticleCategory
    func setActive(categoryID: Int, isActive: Bool) async throws -> ArticleCategory
    func reorder(categoryIDs: [Int]) async throws
    func delete(categoryID: Int, targetCategoryID: Int) async throws -> Int
    func merge(sourceCategoryID: Int, targetCategoryID: Int) async throws
    func optimize(_ draft: CategoryDraft) async throws -> CategoryDraft
    func recordRecent(categoryID: Int)
    func count(for categoryID: Int) -> Int
}
```

```swift
@MainActor
protocol CategoryRecentStoring: AnyObject {
    func load(userID: Int) -> [Int]
    func save(_ categoryIDs: [Int], userID: Int)
}
```

- [ ] **Step 1: 写失败测试，固定共享目录与最近使用行为**

在 `CategoryCatalogModelTests.swift` 添加：

```swift
@Test func 加载分类目录会规范计数并只按服务端顺序暴露启用分类() async
@Test func 切换用户会清空分类和最近使用并读取新用户记录() async
@Test func 旧用户分类响应晚到不会写入新用户()
@Test func 刷新会移除已删除或停用的最近分类() async
@Test func 创建分类成功后立即进入共享目录() async
```

断言示例：

```swift
#expect(model.categories.map(\.id) == [21, 31, 11])
#expect(model.activeCategories.map(\.id) == [21, 31])
#expect(model.count(for: 21) == 4)
#expect(model.recentCategoryIDs == [31, 21])
```

在 `CategoryRecentStoreTests.swift` 添加：

```swift
@Test func 最近分类按用户隔离且最多保留五个()
@Test func 无效ID和重复ID会被过滤()
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
pnpm macos:test
```

Expected: 编译失败，提示找不到 `CategoryCatalogModel`、`CategoryRecentStoring` 或相关测试类型。

- [ ] **Step 3: 实现分类模型、服务和最近使用存储**

实现要求：

- `counts` 从服务端 `[String: Int]` 转为 `[Int: Int]`。
- `prepareUser(userID:)` 清空目录、计数和内存最近使用；用户非空时从本地存储读取。
- 维护独立 `requestGeneration`；`prepareUser` 递增代际，所有分类读取和变更响应只有代际仍匹配时才可写回。
- `load()` 成功后按 `sortOrder`、`id` 排序，并过滤最近使用中不存在或停用的 ID。
- 目录或计数发生有效变化后调用 `onCategoriesChanged`，供 AppModel 校验当前筛选。
- `create(_:)` 使用名称和非空高级字段构造 `CategoryMutationRequest`，成功后把新分类插入共享目录。
- `recordRecent(categoryID:)` 只记录启用分类，移到首位并裁剪到 5 个。
- 所有会修改目录的方法成功后更新 `categories`、`counts` 或重新 `load()`，失败时保留旧目录。
- 错误消息使用现有 `managementErrorMessage(for:)`。

- [ ] **Step 4: 运行测试确认通过**

Run:

```bash
pnpm macos:test
```

Expected: `CategoryCatalogModelTests` 和 `CategoryRecentStoreTests` 通过，完整套件无失败。

- [ ] **Step 5: 提交**

```bash
git add apps/macos/QiankunjieMac/Features/Categories apps/macos/QiankunjieMacTests/CategoryCatalogModelTests.swift apps/macos/QiankunjieMacTests/CategoryRecentStoreTests.swift
git commit -m "feat(macos): 建立共享分类目录"
```

---

### Task 2: AppModel 分类导航与侧栏分类入口

**Files:**

- Modify: `apps/macos/QiankunjieMac/App/AppModel.swift`
- Modify: `apps/macos/QiankunjieMac/App/SidebarView.swift`
- Create: `apps/macos/QiankunjieMac/Features/Categories/SidebarArchiveCategoryGroup.swift`
- Test: `apps/macos/QiankunjieMacTests/CategoryNavigationTests.swift`

**Interfaces:**

- Consumes: `CategoryCatalogModel`、`LibraryModel.selectCategory(_:)`。
- Produces:

```swift
final class AppModel {
    let categoryCatalog: CategoryCatalogModel
    private(set) var selectedCategoryID: Int?
    init(..., categoryCatalog: CategoryCatalogModel? = nil)
    func selectCategory(_ categoryID: Int?)
    func validateSelectedCategory()
}
```

```swift
struct SidebarArchiveCategoryGroup: View {
    @Bindable var model: AppModel
    @Binding var isExpanded: Bool
}
```

- [ ] **Step 1: 写失败的导航测试**

新增测试：

```swift
@Test func 选择分类会切换到归档并同步资料库筛选() async
@Test func 选择其他资料库栏目会清空当前分类() async
@Test func 分类被删除后当前筛选自动回到全部归档() async
```

关键断言：

```swift
#expect(model.destination == .archive)
#expect(model.selectedCategoryID == 21)
#expect(model.libraryModel.categoryId == 21)
#expect(model.libraryModel.view == .archive)
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm macos:test`

Expected: 编译失败，`AppModel` 尚无 `categoryCatalog`、`selectedCategoryID` 或 `selectCategory`。

- [ ] **Step 3: 实现 AppModel 同步和侧栏分组**

实现要求：

- `AppModel` 默认注入 `CategoryCatalogModel`，测试可注入替身。
- `AppModel` 设置 `categoryCatalog.onCategoriesChanged`，回调中执行 `validateSelectedCategory()`。
- `synchronizeWithAuthentication()` 调用 `categoryCatalog.prepareUser(userID:)`；登录用户继续 `await categoryCatalog.load()`。
- `selectDestination(_:)` 在非 `.archive` 时清空 `selectedCategoryID`；选择 `.archive` 主行时也清空分类。
- `selectCategory(_:)` 设置 `.archive`、`selectedCategoryID`，先 `libraryModel.select(view: .archive)`，再 `selectCategory(categoryID)`，最后加载列表。
- 分类目录每次加载完成后调用 `validateSelectedCategory()`；当前分类不存在或已停用时回到全部归档。
- `.categories` 继续表示管理页；侧栏“管理分类…”调用 `selectDestination(.categories)`。
- `SidebarArchiveCategoryGroup` 使用独立箭头展开分类，归档行点击只负责打开全部归档。
- 分类行显示颜色点、名称和计数；当前选中态同时匹配 `destination == .archive` 与 `selectedCategoryID`。
- 认证用户加载分类目录；游客不显示分类子行。

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm macos:test`

Expected: 新增导航测试通过，侧栏和资料库现有测试继续通过。

- [ ] **Step 5: 提交**

```bash
git add apps/macos/QiankunjieMac/App/AppModel.swift apps/macos/QiankunjieMac/App/SidebarView.swift apps/macos/QiankunjieMac/Features/Categories/SidebarArchiveCategoryGroup.swift apps/macos/QiankunjieMacTests/CategoryNavigationTests.swift
git commit -m "feat(macos): 前置分类导航入口"
```

---

### Task 3: 统一分类选择器状态与界面

**Files:**

- Create: `apps/macos/QiankunjieMac/Features/Categories/CategoryPickerModel.swift`
- Create: `apps/macos/QiankunjieMac/Features/Categories/CategoryPickerContent.swift`
- Test: `apps/macos/QiankunjieMacTests/CategoryPickerModelTests.swift`

**Interfaces:**

- Consumes: `CategoryCatalogModel`、`CategoryDraft`、`CategoryAssignmentOutcome`。
- Produces:

```swift
@MainActor
final class CategoryPickerModel: Observable {
    let selectedCategoryID: Int?
    let targetCount: Int
    var query: String
    private(set) var isSubmitting: Bool
    private(set) var errorMessage: String?

    var recentCategories: [ArticleCategory] { get }
    var filteredCategories: [ArticleCategory] { get }
    var exactMatch: ArticleCategory? { get }
    var canCreate: Bool { get }

    init(catalog: CategoryCatalogModel, selectedCategoryID: Int?, targetCount: Int)
    func selectExisting(
        _ category: ArticleCategory,
        assign: @MainActor (ArticleCategory) async -> CategoryAssignmentOutcome
    ) async -> Bool
    func createAndAssign(
        assign: @MainActor (ArticleCategory) async -> CategoryAssignmentOutcome
    ) async -> Bool
    func assignWithAI(
        assign: @MainActor () async -> CategoryAssignmentOutcome
    ) async -> Bool
}
```

```swift
struct CategoryPickerContent: View {
    @Bindable var model: CategoryPickerModel
    let title: String
    let subtitle: String
    let onSelectCategory: @MainActor (ArticleCategory) async -> CategoryAssignmentOutcome
    let onSelectAI: @MainActor () async -> CategoryAssignmentOutcome
    let onDismiss: () -> Void
}
```

- [ ] **Step 1: 写失败测试，固定搜索、最近使用和部分成功**

新增测试：

```swift
@Test func 搜索只过滤启用分类并隐藏无关的最近使用()
@Test func 输入同名分类时优先使用现有分类且禁止创建()
@Test func 最近使用按目录记录顺序展示()
@Test func 创建并分类成功后记录最近使用()
@Test func 创建成功但分类部分失败时保留分类并显示部分成功()
@Test func 选择器中的分类已被删除时显示错误并刷新目录()
@Test func AI 判断成功关闭选择器且不记录最近分类()
```

部分成功断言：

```swift
#expect(await model.createAndAssign(assign: { _ in .partial(succeededCount: 1, skippedCount: 1, failedCount: 1, message: "1 篇失败") }) == false)
#expect(model.errorMessage == "分类已创建，但部分文章未完成分类：1 篇失败")
#expect(catalog.activeCategories.contains { $0.name == "产品设计" })
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm macos:test`

Expected: 编译失败，缺少分类选择器模型和结果类型。

- [ ] **Step 3: 实现选择器模型与界面骨架**

实现要求：

- 搜索使用本地化、不区分大小写的名称包含匹配。
- 搜索为空时先展示最近使用，再展示其余启用分类；搜索非空时只展示过滤结果。
- 完全同名匹配只显示现有分类行，不显示创建动作。
- 提交现有分类失败且错误为 `contentUnavailable` 时，保留弹窗、显示“分类已失效”，并调用 catalog 重新加载。
- `selectExisting`、`createAndAssign`、`assignWithAI` 都设置 `isSubmitting`，并通过 defer 恢复。
- 只有 `.success` 才返回 `true` 并记录最近分类；`.partial` 和 `.failure` 保留弹窗。
- UI 顺序固定为搜索框、AI、最近使用、全部分类、创建动作。
- 空目录显示“创建第一个分类”，无搜索结果只显示创建动作，不使用空白页面。
- 键盘 `↑`、`↓`、`Return`、`Esc` 完整可用；打开时搜索框自动聚焦。
- 分类行、AI 项和创建动作提供明确的 Accessibility label/help，VoiceOver 能区分“当前分类”和普通分类。
- 本任务只创建可嵌入内容视图，不替换现有阅读器或批量弹窗。

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm macos:test`

Expected: `CategoryPickerModelTests` 全部通过。

- [ ] **Step 5: 提交**

```bash
git add apps/macos/QiankunjieMac/Features/Categories/CategoryPickerModel.swift apps/macos/QiankunjieMac/Features/Categories/CategoryPickerContent.swift apps/macos/QiankunjieMacTests/CategoryPickerModelTests.swift
git commit -m "feat(macos): 增加统一分类选择器"
```

---

### Task 4: 阅读器单篇 Popover 与归档 Sheet

**Files:**

- Modify: `apps/macos/Packages/QiankunjieKit/Sources/QiankunjieReader/ReaderModel.swift`
- Modify: `apps/macos/QiankunjieMac/Features/Reader/ReaderPaneView.swift`
- Modify: `apps/macos/QiankunjieMac/App/RootWindow.swift`
- Modify: `apps/macos/QiankunjieMac/UILab/UILabFixtures.swift`
- Modify: `apps/macos/QiankunjieMac/UILab/UILabScenario.swift`
- Test: `apps/macos/QiankunjieMacTests/ReaderCategoryEditorTests.swift`
- Test: `apps/macos/Packages/QiankunjieKit/Tests/QiankunjieReaderTests/ReaderModelTests.swift`

**Interfaces:**

- Consumes: `CategoryCatalogModel`、`CategoryPickerModel`、`CategoryPickerContent`、`CategoryAssignmentOutcome`。
- Produces:

```swift
struct ReaderPaneView {
    init(
        selection: ReaderSelection?,
        userID: Int?,
        categoryCatalog: CategoryCatalogModel,
        appFont: AppFontPreference = .standard,
        readerContentWidth: ReaderContentWidthPreference = .normal,
        onReaderContentWidthChange: @escaping (ReaderContentWidthPreference) -> Void = { _ in },
        positionStore: any ReaderPositionStoring,
        networkClient: any ReaderNetworkClient = APIClient(),
        onClose: @escaping () -> Void,
        onLibraryDidChange: @escaping () -> Void
    )
}
```

- [ ] **Step 1: 更新失败测试**

保留并重写 `ReaderCategoryEditorTests`：

```swift
@Test func 阅读器分类标签使用共享选择器Popover()
@Test func 归档并分类使用共享选择器Sheet()
@Test func 阅读器不再自行加载或创建分类目录()
```

在 `ReaderModelTests.swift` 删除旧的分类目录加载/创建断言，新增：

```swift
@Test func 阅读器分类操作只负责移动或归档文章()
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm macos:test`

Expected: 阅读器仍引用 `availableCategories`/`createCategory`，新签名和断言失败。

- [ ] **Step 3: 移除 ReaderModel 的分类目录职责并接入共享选择器**

实现要求：

- 删除 `ReaderModel.availableCategories`、`isCreatingCategory`、`loadCategories()`、`createCategory(name:)` 及其错误状态。
- 从 `ReaderNetworkClient`、其生产实现和测试替身中删除 `categories()`、`createCategory(name:)`，避免保留第二套分类入口。
- 保留 `moveToCategory(_:)`、`classifyArticle()`、`archive(categoryID:)`。
- `ReaderPaneView` 接收 `categoryCatalog`。
- 分类标签点击打开锚定 Popover；标题和副标题分别为“修改分类”“选择分类，或让 AI 判断”。
- 归档动作继续打开 Sheet；标题和副标题分别为“归档并分类”“分类只用于归档文章”。
- 两个容器都使用 `CategoryPickerContent`。
- 单篇移动结果映射为 `.success(1,0)` 或 `.failure(model.actionErrorMessage ?? "分类失败")`。
- AI 结果映射为 `.success(1,0)` 或 `.failure`。
- 成功后调用 `catalog.recordRecent(categoryID:)`（仅手动选择分类）和 `onLibraryDidChange()`。

- [ ] **Step 4: 更新全部调用点并运行测试**

更新 `RootWindow.readerPane` 和 `UILabScenario` 的 `ReaderPaneView` 初始化。在 `UILabFixtures` 增加不访问网络的 `CategoryCatalogModel` 固定实例，供阅读器场景和后续分类场景复用。

Run: `pnpm macos:test`

Expected: 阅读器测试通过，完整套件无失败。

- [ ] **Step 5: 提交**

```bash
git add apps/macos/Packages/QiankunjieKit/Sources/QiankunjieReader/ReaderModel.swift apps/macos/Packages/QiankunjieKit/Tests/QiankunjieReaderTests/ReaderModelTests.swift apps/macos/QiankunjieMac/Features/Reader/ReaderPaneView.swift apps/macos/QiankunjieMac/App/RootWindow.swift apps/macos/QiankunjieMac/UILab/UILabFixtures.swift apps/macos/QiankunjieMac/UILab/UILabScenario.swift apps/macos/QiankunjieMacTests/ReaderCategoryEditorTests.swift
git commit -m "feat(macos): 统一阅读器分类选择流程"
```

---

### Task 5: 资料库筛选、批量选择与共享目录

**Files:**

- Modify: `apps/macos/Packages/QiankunjieKit/Sources/QiankunjieLibrary/LibraryModel.swift`
- Modify: `apps/macos/Packages/QiankunjieKit/Sources/QiankunjieLibrary/LibraryRepository.swift`
- Modify: `apps/macos/Packages/QiankunjieKit/Tests/QiankunjieLibraryTests/LibraryModelTests.swift`
- Modify: `apps/macos/QiankunjieMacTests/AppModelTests.swift`
- Modify: `apps/macos/QiankunjieMacTests/CollectWiringTests.swift`
- Modify: `apps/macos/QiankunjieMac/Features/Library/LibraryToolbar.swift`
- Modify: `apps/macos/QiankunjieMac/Features/Library/CompactArticleListView.swift`
- Modify: `apps/macos/QiankunjieMac/Features/Library/BulkCategorySelectionSheet.swift`
- Modify: `apps/macos/QiankunjieMac/App/RootWindow.swift`

**Interfaces:**

- Consumes: `CategoryCatalogModel`、`CategoryPickerContent`、`CategoryAssignmentOutcome`、`NativeBulkResult`。
- Produces:

```swift
public func runArticleCategory(articleID: Int, category: ArticleCategory) async
public func runBulkCategory(_ category: ArticleCategory) async
```

```swift
struct LibraryToolbar {
    @Bindable var model: LibraryModel
    @Bindable var categoryCatalog: CategoryCatalogModel
    let selectedCategoryID: Int?
    let onSelectCategory: (Int?) -> Void
}
```

```swift
struct BulkCategorySelectionSheet: View {
    @Bindable var model: LibraryModel
    @Bindable var catalog: CategoryCatalogModel
    let request: BulkCategoryRequest
}
```

- [ ] **Step 1: 写失败测试**

更新 `LibraryModelTests.swift`：

```swift
@Test func 单篇分类直接使用传入分类更新文章卡片()
@Test func 批量分类直接使用传入分类更新文章卡片()
@Test func 分类筛选继续作为归档列表查询条件()
```

关键断言：

```swift
#expect(model.articles.first?.category?.id == 21)
#expect(await repository.lastQuery?.categoryId == 21)
```

- [ ] **Step 2: 运行测试确认失败**

Run:

```bash
swift test --package-path apps/macos/Packages/QiankunjieKit --filter LibraryModelTests
pnpm macos:test
```

Expected: 旧方法仍接收 `categoryID`，分类目录仍在资料库加载；新测试失败。

- [ ] **Step 3: 移除资料库分类目录所有权并接入选择器**

实现要求：

- 删除 `LibraryModel.availableCategories`、`selectedCategory`、`loadAvailableCategories()`、`LibraryCategoryFilter`，以及 `LibraryLoading`/`LibraryRepository` 中的 `loadCategoryFilters`。
- 从 `loadAuxiliaryData()` 移除分类筛选请求；`categoryId` 继续用于列表查询。
- `runArticleCategory`、`runBulkCategory` 接收 `ArticleCategory`，使用其 ID 调接口并直接更新卡片分类。
- `LibraryToolbar.categoryPicker` 使用 `categoryCatalog.activeCategories` 和 `catalog.count(for:)`。
- 工具栏当前标签从 `selectedCategoryID` + catalog 推导，不再从 `LibraryModel` 读取。
- 分类菜单显示可见的展开指示，不再使用 `.menuIndicator(.hidden)` 隐藏筛选能力。
- `BulkCategorySelectionSheet` 包装 `CategoryPickerContent`：
  - 手动分类映射 `NativeBulkResult` 为 `CategoryAssignmentOutcome`。
  - AI 操作映射同样结果。
  - 成功后调用 `catalog.recordRecent(categoryID:)`。
- `CompactArticleListView` 增加 `categoryCatalog`、`selectedCategoryID`、`onSelectCategory` 参数并透传。
- `RootWindow` 将 `model.categoryCatalog`、`model.selectedCategoryID`、`model.selectCategory` 传入列表工具栏。

- [ ] **Step 4: 运行完整测试**

Run: `pnpm macos:test`

Expected: 资料库测试、批量分类、归档分类和工具栏测试全部通过。

- [ ] **Step 5: 提交**

```bash
git add apps/macos/Packages/QiankunjieKit/Sources/QiankunjieLibrary/LibraryModel.swift apps/macos/Packages/QiankunjieKit/Sources/QiankunjieLibrary/LibraryRepository.swift apps/macos/Packages/QiankunjieKit/Tests/QiankunjieLibraryTests/LibraryModelTests.swift apps/macos/QiankunjieMac/Features/Library/LibraryToolbar.swift apps/macos/QiankunjieMac/Features/Library/CompactArticleListView.swift apps/macos/QiankunjieMac/Features/Library/BulkCategorySelectionSheet.swift apps/macos/QiankunjieMac/App/RootWindow.swift apps/macos/QiankunjieMacTests/AppModelTests.swift apps/macos/QiankunjieMacTests/CollectWiringTests.swift
git commit -m "feat(macos): 统一资料库分类入口"
```

---

### Task 6: 轻量创建表单与侧栏内联新建

**Files:**

- Create: `apps/macos/QiankunjieMac/Features/Categories/CategoryQuickCreateView.swift`
- Modify: `apps/macos/QiankunjieMac/Features/Categories/CategoryModels.swift`
- Modify: `apps/macos/QiankunjieMac/Features/Categories/SidebarArchiveCategoryGroup.swift`
- Modify: `apps/macos/QiankunjieMac/App/AppModel.swift`
- Test: `apps/macos/QiankunjieMacTests/CategoryQuickCreatePolicyTests.swift`
- Test: `apps/macos/QiankunjieMacTests/CategoryNavigationTests.swift`

**Interfaces:**

- Consumes: `CategoryCatalogModel.create(_:)`、`CategoryDraft`。
- Produces:

```swift
enum CategoryQuickCreatePolicy {
    static func normalizedName(_ rawValue: String) -> String
    static func canSubmit(name: String, isSubmitting: Bool) -> Bool
    static func suggestedColor(for name: String, existingColors: [String]) -> String
}
```

```swift
struct CategoryQuickCreateView: View {
    @Bindable var catalog: CategoryCatalogModel
    let initialName: String
    let primaryActionTitle: String
    let onCancel: () -> Void
    let onCreated: @MainActor (ArticleCategory) async -> Void
}
```

```swift
func AppModel.createCategoryAndSelect(_ draft: CategoryDraft) async -> ArticleCategory?
```

- [ ] **Step 1: 写失败测试**

新增策略测试：

```swift
@Test func 分类名称会去除首尾空白并按非空校验()
@Test func 相同名称稳定得到相同颜色()
@Test func 可选颜色会避开已使用颜色()
```

在导航测试中增加：

```swift
@Test func 侧栏创建分类后自动进入新分类归档()
@Test func 创建成功但选择失败时保留分类并返回错误()
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm macos:test`

Expected: 缺少快速创建策略、表单和 `createCategoryAndSelect`。

- [ ] **Step 3: 实现轻量创建和侧栏接入**

实现要求：

- 默认只显示名称输入、折叠的“详细规则（可选）”和创建按钮。
- “详细规则”展开后显示说明、适合收录、不适合收录、颜色和 AI 优化。
- Enter 触发创建，Esc 取消；提交中禁用全部输入。
- 名称输入、详细规则折叠按钮和主操作按钮提供 Accessibility label；高级规则展开后焦点进入分类说明。
- 同名冲突时保留输入并显示服务端消息。
- `AppModel.createCategoryAndSelect` 创建成功后调用 `selectCategory(new.id)`；选择失败时保留新分类并设置可显示错误。
- 侧栏“新建分类…”打开 `CategoryQuickCreateView`；成功后关闭弹窗并进入新分类。
- 管理页后续也复用同一表单，不创建第二套快速创建 UI。

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm macos:test`

Expected: 快速创建策略与侧栏创建测试通过。

- [ ] **Step 5: 提交**

```bash
git add apps/macos/QiankunjieMac/Features/Categories/CategoryQuickCreateView.swift apps/macos/QiankunjieMac/Features/Categories/CategoryModels.swift apps/macos/QiankunjieMac/Features/Categories/SidebarArchiveCategoryGroup.swift apps/macos/QiankunjieMac/App/AppModel.swift apps/macos/QiankunjieMacTests/CategoryQuickCreatePolicyTests.swift apps/macos/QiankunjieMacTests/CategoryNavigationTests.swift
git commit -m "feat(macos): 支持一行创建分类"
```

---

### Task 7: 分类管理页改为列表与详情

**Files:**

- Create: `apps/macos/QiankunjieMac/Features/Settings/CategoryManagementModel.swift`
- Modify: `apps/macos/QiankunjieMac/Features/Settings/CategoryManagementView.swift`
- Modify: `apps/macos/QiankunjieMac/Features/Settings/CategoryEditorOverlay.swift`
- Modify: `apps/macos/QiankunjieMac/App/RootWindow.swift`
- Test: `apps/macos/QiankunjieMacTests/CategoryManagementModelTests.swift`
- Test: `apps/macos/QiankunjieMacTests/CategoryEditorSheetTests.swift`

**Interfaces:**

- Consumes: `CategoryCatalogModel`、`CategoryQuickCreateView`、`CategoryDraft`。
- Produces:

```swift
@MainActor
final class CategoryManagementModel: Observable {
    let catalog: CategoryCatalogModel
    var selectedCategoryID: Int?
    var searchText: String
    var isCreating: Bool
    var editingCategory: ArticleCategory?
    var deletingCategory: ArticleCategory?
    private(set) var errorMessage: String?
    private(set) var noticeMessage: String?
    private(set) var isSaving: Bool

    var filteredCategories: [ArticleCategory] { get }
    var selectedCategory: ArticleCategory? { get }

    init(catalog: CategoryCatalogModel)
    func load() async
    func select(categoryID: Int?)
    func save(_ draft: CategoryDraft, editing: ArticleCategory?) async
    func setActive(_ category: ArticleCategory, isActive: Bool) async
    func reorder(moving categoryID: Int, offset: Int) async
    func delete(_ category: ArticleCategory, targetCategoryID: Int) async
    func merge(_ source: ArticleCategory, into target: ArticleCategory) async
    func optimize(_ draft: CategoryDraft) async -> CategoryDraft?
}
```

```swift
struct CategoryManagementView: View {
    init(catalog: CategoryCatalogModel)
}
```

- [ ] **Step 1: 写失败测试**

新增 `CategoryManagementModelTests.swift`：

```swift
@Test func 管理页搜索按名称过滤并保持选中详情()
@Test func 排序成功后共享目录立即更新()
@Test func 删除分类会迁移文章并刷新目录()
@Test func 合并分类后源分类从共享目录移除()
@Test func 详细编辑仍保留完整规则字段()
```

更新 `CategoryEditorSheetTests.swift`，断言高级编辑器仍包含名称、说明、适合收录、不适合收录和颜色，但创建入口使用 `CategoryQuickCreateView`。

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm macos:test`

Expected: 管理模型仍直接持有 `ManagementAPIClient`，新接口和布局断言失败。

- [ ] **Step 3: 实现管理模型和列表详情界面**

实现要求：

- 把分类数据、计数和变更全部委托给共享 `CategoryCatalogModel`。
- 左侧列表显示颜色点、名称、文章数、启用状态；顶部有搜索框和“新增分类”。
- 分类列表使用 VoiceOver 可读的名称、文章数和启停状态；拖拽排序同时保留上下移动按钮作为键盘可访问替代。
- 右侧详情显示选中分类；系统分类只读。
- 拖拽/上下移动调用 catalog 排序；启用开关、删除和合并调用 catalog 对应方法。
- 删除前必须选择目标分类；合并前必须选择目标分类。
- “新增分类”打开 `CategoryQuickCreateView`；编辑规则继续打开 `CategoryEditorOverlay`。
- `RootWindow` 使用 `CategoryManagementView(catalog: model.categoryCatalog)`。
- 切换用户时管理页清空选择；由 AppModel 的分类同步负责目录重置。

- [ ] **Step 4: 运行完整测试**

Run: `pnpm macos:test`

Expected: 管理页模型和视图测试通过，完整套件无失败。

- [ ] **Step 5: 提交**

```bash
git add apps/macos/QiankunjieMac/Features/Settings/CategoryManagementModel.swift apps/macos/QiankunjieMac/Features/Settings/CategoryManagementView.swift apps/macos/QiankunjieMac/Features/Settings/CategoryEditorOverlay.swift apps/macos/QiankunjieMac/App/RootWindow.swift apps/macos/QiankunjieMacTests/CategoryManagementModelTests.swift apps/macos/QiankunjieMacTests/CategoryEditorSheetTests.swift
git commit -m "feat(macos): 重构分类管理页"
```

---

### Task 8: UI Lab、视觉验收与最终验证

**Files:**

- Modify: `apps/macos/QiankunjieMac/UILab/UILabFixtures.swift`
- Modify: `apps/macos/QiankunjieMac/UILab/UILabScenario.swift`
- Modify: `apps/macos/QiankunjieMacTests/UILabTests.swift`
- Modify: `apps/macos/scripts/macos-ui-lab.sh`
- Modify: `docs/MacOS-UI-Lab.md`
- Test: `apps/macos/QiankunjieMacTests/UILabTests.swift`

**Interfaces:**

- Consumes: 所有前序任务产出的分类目录、选择器、快速创建和管理页。
- Produces:

```swift
enum UILabScenario {
    case categoryPicker = "category-picker"
    case categoryManagement = "category-management"
}
```

- [ ] **Step 1: 写失败测试**

更新 `UILabTests.swift`：

```swift
@Test func uiLabCoversCategoryNavigationPickerAndManagement()
@Test func uiLabCategoryFixturesExposeActiveInactiveAndSystemCategories()
```

断言新增场景存在，且固定夹具包含：

- 启用的“工作”“技术”。
- 停用分类。
- 系统分类“待整理”。

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm macos:test`

Expected: `UILabScenario` 缺少新场景，夹具没有完整分类目录。

- [ ] **Step 3: 增加 UI Lab 场景和文档**

实现要求：

- `library` 场景侧栏展示分类目录，用于验证信息架构。
- `category-picker` 展示搜索框、AI、最近使用、全部分类和内联创建动作。
- `category-management` 展示列表 + 详情、轻量创建按钮和高级编辑入口。
- 使用 `FixtureCategoryCatalogService`，不访问真实 API 或用户数据。
- `UILabFixtures.appModel` 注入同一个固定分类目录实例，确保 `library` 场景的侧栏来自真实生产组件。
- 更新脚本允许值、用法说明、场景表、截图路径和人工验收清单。

- [ ] **Step 4: 运行完整测试并做实际渲染检查**

Run:

```bash
pnpm macos:test
bash apps/macos/scripts/macos-ui-lab.sh library light
bash apps/macos/scripts/macos-ui-lab.sh category-picker light
bash apps/macos/scripts/macos-ui-lab.sh category-picker dark
bash apps/macos/scripts/macos-ui-lab.sh category-management light
bash apps/macos/scripts/macos-ui-lab.sh category-management dark
```

人工确认：

- 侧栏分类层级不挤压原有栏目。
- 分类选择器无尺寸跳动，当前分类和最近使用清楚。
- 搜索无结果时“创建并分类”动作可读。
- 重复名称、部分成功和网络错误文案不溢出。
- 深色模式下颜色点、选中态和禁用态可辨识。

- [ ] **Step 5: 最终检查并提交**

Run:

```bash
git diff --check
git status --short --branch
```

Expected:

- 仅包含本计划涉及文件。
- `artifacts/` 保持未跟踪且不进入提交。
- `pnpm macos:test` 输出 `TEST SUCCEEDED`。

本阶段不新增远端埋点。规格中的成功指标用于发布后观察和后续数据分析；验收以操作路径、UI Lab 和完整测试为准。

```bash
git add apps/macos/QiankunjieMac/UILab/UILabFixtures.swift apps/macos/QiankunjieMac/UILab/UILabScenario.swift apps/macos/QiankunjieMacTests/UILabTests.swift apps/macos/scripts/macos-ui-lab.sh docs/MacOS-UI-Lab.md
git commit -m "test(macos): 补齐分类体验视觉验收"
```

---

## 后续独立计划

本计划完成并通过 macOS 实际验收后，再分别创建：

1. `2026-10-23-category-ux-refresh-android.md`
2. `2026-10-23-category-ux-refresh-web.md`

这两份计划只复用本计划验证过的交互契约和文案，不复用 Swift 界面实现。
