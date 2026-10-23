import Foundation
import QiankunjieCore
import QiankunjieLibrary
import Testing
@testable import QiankunjieMac

@MainActor
struct CategoryPickerModelTests {
    @Test func 搜索只过滤启用分类并隐藏无关的最近使用() async {
        let service = 选择器分类服务桩(列表响应: [
            目录响应(
                分类(id: 1, name: "产品设计", sortOrder: 10),
                分类(id: 2, name: "工程实践", sortOrder: 20),
                分类(id: 3, name: "旧设计规范", sortOrder: 30, isActive: false),
                分类(id: 4, name: "视觉设计", sortOrder: 40)
            ),
        ])
        let store = 选择器最近分类存储桩(记录: [7: [2, 3, 1]])
        let catalog = CategoryCatalogModel(service: service, recentStore: store)
        catalog.prepareUser(userID: 7)
        await catalog.load()
        let model = CategoryPickerModel(
            catalog: catalog,
            selectedCategoryID: nil,
            targetCount: 2
        )

        model.query = "设计"

        #expect(model.recentCategories.isEmpty)
        #expect(model.filteredCategories.map(\.id) == [1, 4])
    }

    @Test func 输入同名分类时优先使用现有分类且禁止创建() async {
        let 产品设计 = 分类(id: 1, name: "产品设计", sortOrder: 10)
        let service = 选择器分类服务桩(列表响应: [目录响应(产品设计)])
        let catalog = await 准备分类目录(service: service, userID: 7)
        let model = CategoryPickerModel(
            catalog: catalog,
            selectedCategoryID: nil,
            targetCount: 1
        )
        model.query = " 产品设计 "
        var 实际分配分类: ArticleCategory?

        let 成功 = await model.createAndAssign { category in
            实际分配分类 = category
            return .success(succeededCount: 1, skippedCount: 0)
        }

        #expect(model.exactMatch == 产品设计)
        #expect(!model.canCreate)
        #expect(成功)
        #expect(实际分配分类 == 产品设计)
        #expect(await service.已创建分类名称() == [])
    }

    @Test func 最近使用按目录记录顺序展示() async {
        let service = 选择器分类服务桩(列表响应: [
            目录响应(
                分类(id: 1, name: "产品", sortOrder: 10),
                分类(id: 2, name: "工程", sortOrder: 20),
                分类(id: 3, name: "设计", sortOrder: 30),
                分类(id: 4, name: "阅读", sortOrder: 40)
            ),
        ])
        let store = 选择器最近分类存储桩(记录: [7: [3, 1, 2]])
        let catalog = CategoryCatalogModel(service: service, recentStore: store)
        catalog.prepareUser(userID: 7)
        await catalog.load()
        let model = CategoryPickerModel(
            catalog: catalog,
            selectedCategoryID: nil,
            targetCount: 1
        )

        #expect(model.recentCategories.map(\.id) == [3, 1, 2])
        #expect(model.filteredCategories.map(\.id) == [4])
    }

    @Test func 创建并分类成功后记录最近使用() async {
        let 新分类 = 分类(id: 2, name: "产品设计", sortOrder: 20)
        let service = 选择器分类服务桩(
            列表响应: [目录响应(分类(id: 1, name: "工程", sortOrder: 10))],
            创建响应: [.success(CategoryResponse(category: 新分类))]
        )
        let store = 选择器最近分类存储桩()
        let catalog = CategoryCatalogModel(service: service, recentStore: store)
        catalog.prepareUser(userID: 7)
        await catalog.load()
        let model = CategoryPickerModel(
            catalog: catalog,
            selectedCategoryID: nil,
            targetCount: 1
        )
        model.query = " 产品设计 "
        var 实际分配分类: ArticleCategory?

        let 成功 = await model.createAndAssign { category in
            实际分配分类 = category
            return .success(succeededCount: 1, skippedCount: 0)
        }

        #expect(成功)
        #expect(实际分配分类 == 新分类)
        #expect(catalog.activeCategories.contains { $0.name == "产品设计" })
        #expect(catalog.recentCategoryIDs == [2])
        #expect(store.记录[7] == [2])
        #expect(await service.已创建分类名称() == ["产品设计"])
    }

    @Test func 创建成功但分类部分失败时保留分类并显示部分成功() async {
        let 新分类 = 分类(id: 2, name: "产品设计", sortOrder: 20)
        let service = 选择器分类服务桩(
            列表响应: [目录响应(分类(id: 1, name: "工程", sortOrder: 10))],
            创建响应: [.success(CategoryResponse(category: 新分类))]
        )
        let store = 选择器最近分类存储桩()
        let catalog = CategoryCatalogModel(service: service, recentStore: store)
        catalog.prepareUser(userID: 7)
        await catalog.load()
        let model = CategoryPickerModel(
            catalog: catalog,
            selectedCategoryID: nil,
            targetCount: 3
        )
        model.query = "产品设计"

        let 成功 = await model.createAndAssign { _ in
            .partial(
                succeededCount: 1,
                skippedCount: 1,
                failedCount: 1,
                message: "1 篇失败"
            )
        }

        #expect(!成功)
        #expect(model.errorMessage == "分类已创建，但部分文章未完成分类：1 篇失败")
        #expect(catalog.activeCategories.contains { $0.name == "产品设计" })
        #expect(catalog.recentCategoryIDs.isEmpty)
        #expect(!model.isSubmitting)
    }

    @Test func 初始目录加载期间禁止创建并在加载完成后保留已有分类() async {
        let service = 可暂停首次加载服务桩(
            目录: 目录响应(分类(id: 1, name: "已有分类", sortOrder: 10)),
            新分类: 分类(id: 2, name: "新产品设计", sortOrder: 20)
        )
        let catalog = CategoryCatalogModel(
            service: service,
            recentStore: 选择器最近分类存储桩()
        )
        catalog.prepareUser(userID: 7)
        let 加载任务 = Task { @MainActor in
            await catalog.load()
        }
        await service.等待列表请求开始()

        let model = CategoryPickerModel(
            catalog: catalog,
            selectedCategoryID: nil,
            targetCount: 1
        )
        model.query = "新产品设计"
        var 分配次数 = 0

        #expect(!model.canCreate)
        let 成功 = await model.createAndAssign { _ in
            分配次数 += 1
            return .success(succeededCount: 1, skippedCount: 0)
        }

        #expect(!成功)
        #expect(model.errorMessage == "分类目录尚未加载完成，请稍后重试")
        #expect(分配次数 == 0)
        #expect(await service.已创建分类名称() == [])

        await service.放行列表响应()
        await 加载任务.value

        #expect(catalog.hasLoadedCatalog)
        #expect(catalog.activeCategories.map(\.id) == [1])
    }

    @Test func 可信缓存刷新挂起时仍可选择已有分类并使用AI() async {
        let 已有分类 = 分类(id: 1, name: "产品设计", sortOrder: 10)
        let service = 可信缓存刷新服务桩(
            初始目录: 目录响应(已有分类),
            刷新目录: 目录响应(已有分类),
            新分类: 分类(id: 2, name: "新分类", sortOrder: 20)
        )
        let catalog = await 准备分类目录(service: service, userID: 7)
        let model = CategoryPickerModel(
            catalog: catalog,
            selectedCategoryID: nil,
            targetCount: 1
        )
        let 刷新任务 = Task { @MainActor in
            await catalog.load()
        }
        await service.等待刷新请求开始()

        #expect(!model.isInitialCatalogLoading)
        #expect(!model.isInteractionDisabled)

        let 选择成功 = await model.selectExisting(已有分类) { _ in
            .success(succeededCount: 1, skippedCount: 0)
        }
        let AI成功 = await model.assignWithAI {
            .success(succeededCount: 1, skippedCount: 0)
        }

        #expect(选择成功)
        #expect(AI成功)

        await service.放行刷新响应()
        await 刷新任务.value
    }

    @Test func 可信缓存刷新挂起时仍可创建并丢弃旧刷新结果() async {
        let 已有分类 = 分类(id: 1, name: "产品设计", sortOrder: 10)
        let 新分类 = 分类(id: 2, name: "市场研究", sortOrder: 20)
        let service = 可信缓存刷新服务桩(
            初始目录: 目录响应(已有分类),
            刷新目录: 目录响应(已有分类),
            新分类: 新分类
        )
        let catalog = await 准备分类目录(service: service, userID: 7)
        let model = CategoryPickerModel(
            catalog: catalog,
            selectedCategoryID: nil,
            targetCount: 1
        )
        model.query = "市场研究"
        let 刷新任务 = Task { @MainActor in
            await catalog.load()
        }
        await service.等待刷新请求开始()

        #expect(model.canCreate)
        let 创建成功 = await model.createAndAssign { _ in
            .success(succeededCount: 1, skippedCount: 0)
        }

        #expect(创建成功)
        #expect(catalog.activeCategories.map(\.id) == [1, 2])

        await service.放行刷新响应()
        await 刷新任务.value

        #expect(catalog.activeCategories.map(\.id) == [1, 2])
        #expect(await service.已创建分类名称() == ["市场研究"])
    }

    @Test func 结构化分类失效结果会显示错误并刷新目录() async {
        let service = 选择器分类服务桩(列表响应: [
            目录响应(
                分类(id: 1, name: "产品设计", sortOrder: 10),
                分类(id: 2, name: "工程实践", sortOrder: 20)
            ),
            目录响应(分类(id: 2, name: "工程实践", sortOrder: 20)),
        ])
        let store = 选择器最近分类存储桩(记录: [7: [1, 2]])
        let catalog = CategoryCatalogModel(service: service, recentStore: store)
        catalog.prepareUser(userID: 7)
        await catalog.load()
        let model = CategoryPickerModel(
            catalog: catalog,
            selectedCategoryID: nil,
            targetCount: 1
        )
        let 已删除分类 = catalog.activeCategories[0]

        let 成功 = await model.selectExisting(已删除分类) { _ in
            .categoryUnavailable(message: "分类已被删除")
        }

        #expect(!成功)
        #expect(model.errorMessage == "分类已被删除")
        #expect(await service.列表请求次数() == 2)
        #expect(catalog.categories.map(\.id) == [2])
        #expect(catalog.recentCategoryIDs == [2])
        #expect(!model.isSubmitting)
    }

    @Test func 选择器打开后分类失效会刷新共享目录() async {
        let service = 选择器分类服务桩(列表响应: [
            目录响应(
                分类(id: 1, name: "产品设计", sortOrder: 10),
                分类(id: 2, name: "工程实践", sortOrder: 20)
            ),
            目录响应(分类(id: 2, name: "工程实践", sortOrder: 20)),
        ])
        let catalog = CategoryCatalogModel(
            service: service,
            recentStore: 选择器最近分类存储桩()
        )
        catalog.prepareUser(userID: 7)
        await catalog.load()
        let model = CategoryPickerModel(
            catalog: catalog,
            selectedCategoryID: nil,
            targetCount: 1
        )
        let 已失效分类 = catalog.activeCategories[0]
        let 后端结果 = NativeBulkResult(
            requestedCount: 1,
            succeededCount: 0,
            skippedCount: 0,
            failedCount: 1,
            issues: [
                ArticleBulkIssue(
                    articleID: 7,
                    code: "CATEGORY_UNAVAILABLE",
                    message: "分类不存在或已停用"
                )
            ]
        )
        let 映射结果 = BulkCategoryOutcomeMapper.outcome(
            result: 后端结果,
            error: .categoryUnavailable(message: "分类不存在或已停用"),
            operation: .manual
        )

        let 成功 = await model.selectExisting(已失效分类) { _ in
            映射结果
        }

        #expect(!成功)
        #expect(model.errorMessage == "分类不存在或已停用")
        #expect(await service.列表请求次数() == 2)
        #expect(catalog.activeCategories.map(\.id) == [2])
    }

    @Test func 结构化内容失效结果保留文案且不刷新分类目录() async {
        let service = 选择器分类服务桩(列表响应: [
            目录响应(分类(id: 1, name: "产品设计", sortOrder: 10)),
        ])
        let catalog = CategoryCatalogModel(
            service: service,
            recentStore: 选择器最近分类存储桩()
        )
        catalog.prepareUser(userID: 7)
        await catalog.load()
        let model = CategoryPickerModel(
            catalog: catalog,
            selectedCategoryID: nil,
            targetCount: 1
        )

        let 成功 = await model.selectExisting(catalog.activeCategories[0]) { _ in
            .contentUnavailable(message: "请求的文章不可用")
        }

        #expect(!成功)
        #expect(model.errorMessage == "请求的文章不可用")
        #expect(await service.列表请求次数() == 1)
        #expect(catalog.activeCategories.map(\.id) == [1])
    }

    @Test func 空分类失效文案回退为分类已失效() async {
        let service = 选择器分类服务桩(列表响应: [
            目录响应(分类(id: 1, name: "产品设计", sortOrder: 10)),
            目录响应(分类(id: 1, name: "产品设计", sortOrder: 10)),
        ])
        let catalog = CategoryCatalogModel(
            service: service,
            recentStore: 选择器最近分类存储桩()
        )
        catalog.prepareUser(userID: 7)
        await catalog.load()
        let model = CategoryPickerModel(
            catalog: catalog,
            selectedCategoryID: nil,
            targetCount: 1
        )

        let 成功 = await model.selectExisting(catalog.activeCategories[0]) { _ in
            .categoryUnavailable(message: "   ")
        }

        #expect(!成功)
        #expect(model.errorMessage == "分类已失效")
        #expect(await service.列表请求次数() == 2)
    }

    @Test func 空内容失效文案回退为请求的文章不可用() async {
        let service = 选择器分类服务桩(列表响应: [
            目录响应(分类(id: 1, name: "产品设计", sortOrder: 10)),
        ])
        let catalog = CategoryCatalogModel(
            service: service,
            recentStore: 选择器最近分类存储桩()
        )
        catalog.prepareUser(userID: 7)
        await catalog.load()
        let model = CategoryPickerModel(
            catalog: catalog,
            selectedCategoryID: nil,
            targetCount: 1
        )

        let 成功 = await model.selectExisting(catalog.activeCategories[0]) { _ in
            .contentUnavailable(message: "   ")
        }

        #expect(!成功)
        #expect(model.errorMessage == "请求的文章不可用")
        #expect(await service.列表请求次数() == 1)
    }

    @Test func 用户切换后标记失效并禁止继续创建或分配() async {
        let history = 分类(id: 1, name: "历史", sortOrder: 10)
        let service = 选择器分类服务桩(列表响应: [目录响应(history)])
        let catalog = await 准备分类目录(service: service, userID: 7)
        let model = CategoryPickerModel(
            catalog: catalog,
            selectedCategoryID: history.id,
            targetCount: 1
        )
        model.query = "新分类"
        var 分配次数 = 0

        #expect(!model.isStaleForCurrentUser)
        catalog.prepareUser(userID: 8)

        #expect(model.isStaleForCurrentUser)
        #expect(!model.canCreate)
        #expect(model.recentCategories.isEmpty)
        #expect(model.filteredCategories.isEmpty)

        let 选择成功 = await model.selectExisting(history) { _ in
            分配次数 += 1
            return .success(succeededCount: 1, skippedCount: 0)
        }
        #expect(!选择成功)

        let 创建成功 = await model.createAndAssign { _ in
            分配次数 += 1
            return .success(succeededCount: 1, skippedCount: 0)
        }
        #expect(!创建成功)
        #expect(分配次数 == 0)
        #expect(model.errorMessage == "登录用户已切换，请重新打开分类选择器")
        #expect(await service.已创建分类名称() == [])
    }

    @Test func AI判断成功关闭选择器且不记录最近分类() async {
        let service = 选择器分类服务桩(列表响应: [
            目录响应(分类(id: 1, name: "产品设计", sortOrder: 10)),
        ])
        let store = 选择器最近分类存储桩(记录: [7: [1]])
        let catalog = CategoryCatalogModel(service: service, recentStore: store)
        catalog.prepareUser(userID: 7)
        await catalog.load()
        let model = CategoryPickerModel(
            catalog: catalog,
            selectedCategoryID: nil,
            targetCount: 1
        )
        var AI判断次数 = 0

        let 成功 = await model.assignWithAI {
            AI判断次数 += 1
            return .success(succeededCount: 1, skippedCount: 0)
        }

        #expect(成功)
        #expect(AI判断次数 == 1)
        #expect(catalog.recentCategoryIDs == [1])
        #expect(model.errorMessage == nil)
    }

    @Test func AI批量部分失败保持选择器并显示真实计数() async {
        let service = 选择器分类服务桩(列表响应: [
            目录响应(分类(id: 1, name: "产品设计", sortOrder: 10)),
        ])
        let catalog = CategoryCatalogModel(
            service: service,
            recentStore: 选择器最近分类存储桩()
        )
        catalog.prepareUser(userID: 7)
        await catalog.load()
        let model = CategoryPickerModel(
            catalog: catalog,
            selectedCategoryID: nil,
            targetCount: 3
        )
        let result = NativeBulkResult(from: ArticleBulkAIResult(
            requestedCount: 3,
            queuedIDs: [7],
            alreadyQueuedIDs: [8],
            failed: [
                ArticleBulkIssue(
                    articleID: 9,
                    code: "NOT_FOUND",
                    message: "文章不存在"
                ),
            ]
        ))
        let outcome = BulkCategoryOutcomeMapper.outcome(
            result: result,
            error: nil,
            operation: .ai
        )

        let 成功 = await model.assignWithAI {
            outcome
        }

        #expect(!成功)
        #expect(model.errorMessage?.contains("成功 1 篇") == true)
        #expect(model.errorMessage?.contains("跳过 1 篇") == true)
        #expect(model.errorMessage?.contains("失败 1 篇") == true)
        #expect(!model.isSubmitting)
    }

    @Test func 批量目标数量始终读取当前选择数量() async {
        let service = 选择器分类服务桩(列表响应: [
            目录响应(分类(id: 1, name: "产品设计", sortOrder: 10)),
        ])
        let catalog = await 准备分类目录(service: service, userID: 7)
        var 当前选择数量 = 3
        let model = CategoryPickerModel(
            catalog: catalog,
            selectedCategoryID: nil,
            targetCountProvider: { 当前选择数量 }
        )

        #expect(model.targetCount == 3)

        当前选择数量 = 1

        #expect(model.targetCount == 1)
    }

    @Test func 内联创建遇到服务端同名冲突会刷新目录并允许使用现有分类() async {
        let 现有分类 = 分类(id: 2, name: "产品设计", sortOrder: 20)
        let 冲突消息 = "已存在同名启用分类，请换一个名称"
        let service = 选择器分类服务桩(
            列表响应: [
                目录响应(分类(id: 1, name: "工程实践", sortOrder: 10)),
                目录响应(分类(id: 1, name: "工程实践", sortOrder: 10), 现有分类),
            ],
            创建错误: .categoryConflict(message: 冲突消息)
        )
        let catalog = await 准备分类目录(service: service, userID: 7)
        let model = CategoryPickerModel(
            catalog: catalog,
            selectedCategoryID: nil,
            targetCount: 2
        )
        model.query = "产品设计"
        var 已分配分类: ArticleCategory?

        let 创建成功 = await model.createAndAssign { category in
            已分配分类 = category
            return .success(succeededCount: 2, skippedCount: 0)
        }

        #expect(!创建成功)
        #expect(model.conflictSuggestion == 现有分类)
        #expect(model.query == "产品设计")
        #expect(已分配分类 == nil)
        #expect(await service.列表请求次数() == 2)
        #expect(await service.已创建分类名称() == ["产品设计"])

        let 使用成功 = await model.useExistingCategory { category in
            已分配分类 = category
            return .success(succeededCount: 2, skippedCount: 0)
        }

        #expect(使用成功)
        #expect(已分配分类 == 现有分类)
        #expect(model.conflictSuggestion == nil)
    }
}

@MainActor
private func 准备分类目录(
    service: any CategoryCatalogServicing,
    userID: Int
) async -> CategoryCatalogModel {
    let catalog = CategoryCatalogModel(
        service: service,
        recentStore: 选择器最近分类存储桩()
    )
    catalog.prepareUser(userID: userID)
    await catalog.load()
    return catalog
}

private func 分类(
    id: Int,
    name: String,
    sortOrder: Int,
    isActive: Bool = true
) -> ArticleCategory {
    ArticleCategory(
        id: id,
        name: name,
        sortOrder: sortOrder,
        isActive: isActive
    )
}

private func 目录响应(_ categories: ArticleCategory...) -> CategoriesResponse {
    CategoriesResponse(
        categories: categories,
        counts: Dictionary(
            uniqueKeysWithValues: categories.map { (String($0.id), 0) }
        )
    )
}

private actor 可信缓存刷新服务桩: CategoryCatalogServicing {
    private let 初始目录: CategoriesResponse
    private let 刷新目录: CategoriesResponse
    private let 新分类: ArticleCategory
    private var 列表请求计数 = 0
    private var 刷新请求已开始 = false
    private var 等待刷新开始: CheckedContinuation<Void, Never>?
    private var 等待刷新放行: CheckedContinuation<Void, Never>?
    private var 创建请求名称: [String] = []

    init(
        初始目录: CategoriesResponse,
        刷新目录: CategoriesResponse,
        新分类: ArticleCategory
    ) {
        self.初始目录 = 初始目录
        self.刷新目录 = 刷新目录
        self.新分类 = 新分类
    }

    func list(includeInactive: Bool) async throws -> CategoriesResponse {
        列表请求计数 += 1
        if 列表请求计数 == 1 {
            return 初始目录
        }

        刷新请求已开始 = true
        等待刷新开始?.resume()
        等待刷新开始 = nil
        await withCheckedContinuation { continuation in
            等待刷新放行 = continuation
        }
        return 刷新目录
    }

    func 等待刷新请求开始() async {
        if 刷新请求已开始 { return }
        await withCheckedContinuation { continuation in
            等待刷新开始 = continuation
        }
    }

    func 放行刷新响应() {
        等待刷新放行?.resume()
        等待刷新放行 = nil
    }

    func create(_ request: CategoryMutationRequest) async throws -> CategoryResponse {
        创建请求名称.append(request.name ?? "")
        return CategoryResponse(category: 新分类)
    }

    func update(categoryID: Int, request: CategoryMutationRequest) async throws -> CategoryResponse {
        throw 选择器服务测试错误.缺少响应
    }

    func reorder(categoryIDs: [Int]) async throws -> CategoryReorderResponse {
        throw 选择器服务测试错误.缺少响应
    }

    func delete(categoryID: Int, targetCategoryID: Int) async throws -> DeleteCategoryResponse {
        throw 选择器服务测试错误.缺少响应
    }

    func merge(sourceCategoryID: Int, targetCategoryID: Int) async throws {
        throw 选择器服务测试错误.缺少响应
    }

    func optimize(_ request: CategoryOptimizeRequest) async throws -> CategoryOptimizeResponse {
        throw 选择器服务测试错误.缺少响应
    }

    func 已创建分类名称() -> [String] {
        创建请求名称
    }
}

private actor 可暂停首次加载服务桩: CategoryCatalogServicing {
    private let 目录: CategoriesResponse
    private let 新分类: ArticleCategory
    private var 列表请求已开始 = false
    private var 等待开始: CheckedContinuation<Void, Never>?
    private var 等待放行: CheckedContinuation<Void, Never>?
    private var 创建请求名称: [String] = []

    init(目录: CategoriesResponse, 新分类: ArticleCategory) {
        self.目录 = 目录
        self.新分类 = 新分类
    }

    func list(includeInactive: Bool) async throws -> CategoriesResponse {
        列表请求已开始 = true
        等待开始?.resume()
        等待开始 = nil
        await withCheckedContinuation { continuation in
            等待放行 = continuation
        }
        return 目录
    }

    func 等待列表请求开始() async {
        if 列表请求已开始 { return }
        await withCheckedContinuation { continuation in
            等待开始 = continuation
        }
    }

    func 放行列表响应() {
        等待放行?.resume()
        等待放行 = nil
    }

    func create(_ request: CategoryMutationRequest) async throws -> CategoryResponse {
        创建请求名称.append(request.name ?? "")
        return CategoryResponse(category: 新分类)
    }

    func update(categoryID: Int, request: CategoryMutationRequest) async throws -> CategoryResponse {
        throw 选择器服务测试错误.缺少响应
    }

    func reorder(categoryIDs: [Int]) async throws -> CategoryReorderResponse {
        throw 选择器服务测试错误.缺少响应
    }

    func delete(categoryID: Int, targetCategoryID: Int) async throws -> DeleteCategoryResponse {
        throw 选择器服务测试错误.缺少响应
    }

    func merge(sourceCategoryID: Int, targetCategoryID: Int) async throws {
        throw 选择器服务测试错误.缺少响应
    }

    func optimize(_ request: CategoryOptimizeRequest) async throws -> CategoryOptimizeResponse {
        throw 选择器服务测试错误.缺少响应
    }

    func 已创建分类名称() -> [String] {
        创建请求名称
    }
}

private actor 选择器分类服务桩: CategoryCatalogServicing {
    private var 列表响应: [Result<CategoriesResponse, 选择器服务测试错误>]
    private var 创建响应: [Result<CategoryResponse, 选择器服务测试错误>]
    private var 列表请求计数 = 0
    private var 创建请求名称: [String] = []
    private let 创建错误: AppError?

    init(
        列表响应: [CategoriesResponse],
        创建响应: [Result<CategoryResponse, 选择器服务测试错误>] = [],
        创建错误: AppError? = nil
    ) {
        self.列表响应 = 列表响应.map(Result.success)
        self.创建响应 = 创建响应
        self.创建错误 = 创建错误
    }

    func list(includeInactive: Bool) async throws -> CategoriesResponse {
        列表请求计数 += 1
        guard !列表响应.isEmpty else { throw 选择器服务测试错误.缺少响应 }
        return try 列表响应.removeFirst().get()
    }

    func create(_ request: CategoryMutationRequest) async throws -> CategoryResponse {
        创建请求名称.append(request.name ?? "")
        if let 创建错误 { throw 创建错误 }
        guard !创建响应.isEmpty else { throw 选择器服务测试错误.缺少响应 }
        return try 创建响应.removeFirst().get()
    }

    func update(categoryID: Int, request: CategoryMutationRequest) async throws -> CategoryResponse {
        throw 选择器服务测试错误.缺少响应
    }

    func reorder(categoryIDs: [Int]) async throws -> CategoryReorderResponse {
        throw 选择器服务测试错误.缺少响应
    }

    func delete(categoryID: Int, targetCategoryID: Int) async throws -> DeleteCategoryResponse {
        throw 选择器服务测试错误.缺少响应
    }

    func merge(sourceCategoryID: Int, targetCategoryID: Int) async throws {
        throw 选择器服务测试错误.缺少响应
    }

    func optimize(_ request: CategoryOptimizeRequest) async throws -> CategoryOptimizeResponse {
        throw 选择器服务测试错误.缺少响应
    }

    func 列表请求次数() -> Int {
        列表请求计数
    }

    func 已创建分类名称() -> [String] {
        创建请求名称
    }
}

private enum 选择器服务测试错误: Error, Sendable {
    case 缺少响应
}

@MainActor
private final class 选择器最近分类存储桩: CategoryRecentStoring {
    var 记录: [Int: [Int]]

    init(记录: [Int: [Int]] = [:]) {
        self.记录 = 记录
    }

    func load(userID: Int) -> [Int] {
        记录[userID] ?? []
    }

    func save(_ categoryIDs: [Int], userID: Int) {
        记录[userID] = categoryIDs
    }
}
