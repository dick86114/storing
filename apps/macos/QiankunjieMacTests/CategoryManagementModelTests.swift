import QiankunjieCore
import Testing
@testable import QiankunjieMac

@MainActor
struct CategoryManagementModelTests {
    @Test func 管理页搜索按名称过滤并保持选中详情() async {
        let service = 分类管理服务桩(列表响应: [
            .success(CategoriesResponse(
                categories: [
                    分类(id: 1, name: "编程开发", sortOrder: 10),
                    分类(id: 2, name: "产品设计", sortOrder: 20),
                    分类(id: 3, name: "待整理", sortOrder: 30, isSystem: true),
                ],
                counts: ["1": 8, "2": 4, "3": 12]
            )),
        ])
        let catalog = CategoryCatalogModel(
            service: service,
            recentStore: 最近分类存储桩()
        )
        catalog.prepareUser(userID: 7)
        await catalog.load()
        let model = CategoryManagementModel(catalog: catalog)

        model.select(categoryID: 1)
        model.searchText = "  产品  "

        #expect(model.filteredCategories.map(\.id) == [2])
        #expect(model.selectedCategory?.id == 1)
        #expect(model.selectedCategory?.name == "编程开发")
    }

    @Test func 排序成功后共享目录立即更新() async {
        let service = 分类管理服务桩(
            列表响应: [
                .success(CategoriesResponse(
                    categories: [
                        分类(id: 1, name: "第一类", sortOrder: 10),
                        分类(id: 2, name: "第二类", sortOrder: 20),
                        分类(id: 3, name: "第三类", sortOrder: 30),
                    ],
                    counts: [:]
                )),
            ],
            排序响应: [
                .success(CategoryReorderResponse(categories: [
                    分类(id: 2, name: "第二类", sortOrder: 10),
                    分类(id: 1, name: "第一类", sortOrder: 20),
                    分类(id: 3, name: "第三类", sortOrder: 30),
                ])),
            ]
        )
        let catalog = CategoryCatalogModel(
            service: service,
            recentStore: 最近分类存储桩()
        )
        catalog.prepareUser(userID: 7)
        await catalog.load()
        let model = CategoryManagementModel(catalog: catalog)
        let movingCategory = try! #require(catalog.categories.first { $0.id == 1 })

        await model.reorder(moving: movingCategory.id, offset: 1)

        #expect(catalog.categories.map(\.id) == [2, 1, 3])
        #expect(model.filteredCategories.map(\.id) == [2, 1, 3])
        #expect(await service.最近排序请求() == [2, 1, 3])
    }

    @Test func 整卡拖拽提交完整顺序并保护系统分类位置() async {
        let service = 分类管理服务桩(
            列表响应: [
                .success(CategoriesResponse(
                    categories: [
                        分类(id: 1, name: "第一类", sortOrder: 10),
                        分类(id: 2, name: "第二类", sortOrder: 20),
                        分类(id: 3, name: "待整理", sortOrder: 30, isSystem: true),
                    ],
                    counts: [:]
                )),
            ],
            排序响应: [
                .success(CategoryReorderResponse(categories: [
                    分类(id: 2, name: "第二类", sortOrder: 10),
                    分类(id: 1, name: "第一类", sortOrder: 20),
                    分类(id: 3, name: "待整理", sortOrder: 30, isSystem: true),
                ])),
            ]
        )
        let catalog = CategoryCatalogModel(
            service: service,
            recentStore: 最近分类存储桩()
        )
        catalog.prepareUser(userID: 7)
        await catalog.load()
        let model = CategoryManagementModel(catalog: catalog)

        let succeeded = await model.reorder(categoryIDs: [2, 1, 3])

        #expect(succeeded)
        #expect(catalog.categories.map(\.id) == [2, 1, 3])
        #expect(await service.最近排序请求() == [2, 1, 3])
        #expect(model.noticeMessage == "分类顺序已更新")
    }

    @Test func 整卡拖拽拒绝移动系统分类() async {
        let service = 分类管理服务桩(
            列表响应: [
                .success(CategoriesResponse(
                    categories: [
                        分类(id: 1, name: "第一类", sortOrder: 10),
                        分类(id: 2, name: "第二类", sortOrder: 20),
                        分类(id: 3, name: "待整理", sortOrder: 30, isSystem: true),
                    ],
                    counts: [:]
                )),
            ]
        )
        let catalog = CategoryCatalogModel(
            service: service,
            recentStore: 最近分类存储桩()
        )
        catalog.prepareUser(userID: 7)
        await catalog.load()
        let model = CategoryManagementModel(catalog: catalog)

        let succeeded = await model.reorder(categoryIDs: [3, 1, 2])

        #expect(!succeeded)
        #expect(model.errorMessage == "系统分类必须保持固定位置")
        #expect(await service.最近排序请求() == nil)
    }

    @Test func 创建成功使用自动消失的弱提醒() {
        let catalog = CategoryCatalogModel(
            service: 分类管理服务桩(),
            recentStore: 最近分类存储桩()
        )
        let model = CategoryManagementModel(catalog: catalog)
        let category = 分类(id: 12, name: "新分类", sortOrder: 10)

        model.didCreate(category)

        #expect(model.noticeMessage == nil)
        #expect(model.weakNoticeMessage == "分类「新分类」已创建")
    }

    @Test func 管理页采用现有分类只切换选中且不误报创建成功() {
        let catalog = CategoryCatalogModel(
            service: 分类管理服务桩(),
            recentStore: 最近分类存储桩()
        )
        let model = CategoryManagementModel(catalog: catalog)
        let 现有分类 = 分类(id: 12, name: "现有分类", sortOrder: 10)
        model.isCreating = true
        model.weakNoticeMessage = "旧提醒"

        model.didCompleteQuickCreate(.reusedExisting(现有分类))

        #expect(!model.isCreating)
        #expect(model.selectedCategoryID == 现有分类.id)
        #expect(model.noticeMessage == nil)
        #expect(model.weakNoticeMessage == nil)
    }

    @Test func 管理页真正创建分类会显示创建成功弱提醒() {
        let catalog = CategoryCatalogModel(
            service: 分类管理服务桩(),
            recentStore: 最近分类存储桩()
        )
        let model = CategoryManagementModel(catalog: catalog)
        let 新分类 = 分类(id: 13, name: "新分类", sortOrder: 20)
        model.isCreating = true

        model.didCompleteQuickCreate(.created(新分类))

        #expect(!model.isCreating)
        #expect(model.selectedCategoryID == 新分类.id)
        #expect(model.weakNoticeMessage == "分类「新分类」已创建")
    }

    @Test func 删除分类会迁移文章并刷新目录() async {
        let service = 分类管理服务桩(
            列表响应: [
                .success(CategoriesResponse(
                    categories: [
                        分类(id: 1, name: "待删除", sortOrder: 10),
                        分类(id: 2, name: "接收分类", sortOrder: 20),
                    ],
                    counts: ["1": 4, "2": 3]
                )),
            ],
            删除响应: [.success(DeleteCategoryResponse(movedArticleCount: 4))]
        )
        let catalog = CategoryCatalogModel(
            service: service,
            recentStore: 最近分类存储桩()
        )
        catalog.prepareUser(userID: 7)
        await catalog.load()
        let model = CategoryManagementModel(catalog: catalog)
        model.select(categoryID: 1)
        let category = try! #require(catalog.categories.first { $0.id == 1 })

        await model.delete(category, targetCategoryID: 2)

        #expect(catalog.categories.map(\.id) == [2])
        #expect(catalog.count(for: 2) == 7)
        #expect(model.selectedCategoryID == nil)
        #expect(model.noticeMessage == "分类已删除，已迁移 4 篇文章")
    }

    @Test func 合并分类后源分类保留为停用并清除选中详情() async {
        let service = 分类管理服务桩(
            列表响应: [
                .success(CategoriesResponse(
                    categories: [
                        分类(id: 1, name: "重复分类", sortOrder: 10),
                        分类(id: 2, name: "保留分类", sortOrder: 20),
                    ],
                    counts: ["1": 3, "2": 5]
                )),
                .success(CategoriesResponse(
                    categories: [
                        分类(id: 1, name: "重复分类", sortOrder: 10, isActive: false),
                        分类(id: 2, name: "保留分类", sortOrder: 20),
                    ],
                    counts: ["1": 0, "2": 8]
                )),
            ],
            合并响应: [.success(())]
        )
        let catalog = CategoryCatalogModel(
            service: service,
            recentStore: 最近分类存储桩()
        )
        catalog.prepareUser(userID: 7)
        await catalog.load()
        let model = CategoryManagementModel(catalog: catalog)
        model.select(categoryID: 1)
        let source = try! #require(catalog.categories.first { $0.id == 1 })
        let target = try! #require(catalog.categories.first { $0.id == 2 })

        await model.merge(source, into: target)

        #expect(catalog.categories.map(\.id) == [1, 2])
        #expect(catalog.categories.first { $0.id == 1 }?.isActive == false)
        #expect(catalog.activeCategories.map(\.id) == [2])
        #expect(model.filteredCategories.map(\.id) == [1, 2])
        #expect(catalog.count(for: 2) == 8)
        #expect(model.selectedCategoryID == nil)
        #expect(model.noticeMessage == "分类已合并到“保留分类”")
    }

    @Test func 合并已提交但刷新失败会提示刷新并保留软停用行() async {
        let source = 分类(id: 1, name: "重复分类", sortOrder: 10)
        let target = 分类(id: 2, name: "保留分类", sortOrder: 20)
        let service = 分类管理服务桩(
            列表响应: [
                .success(CategoriesResponse(
                    categories: [source, target],
                    counts: ["1": 3, "2": 5]
                )),
                .failure(.network),
            ],
            合并响应: [.success(())]
        )
        let catalog = CategoryCatalogModel(
            service: service,
            recentStore: 最近分类存储桩()
        )
        catalog.prepareUser(userID: 7)
        await catalog.load()
        let model = CategoryManagementModel(catalog: catalog)
        model.select(categoryID: source.id)

        await model.merge(source, into: target)

        #expect(catalog.categories.map(\.id) == [1, 2])
        #expect(catalog.categories.first { $0.id == source.id }?.isActive == false)
        #expect(catalog.activeCategories.map(\.id) == [target.id])
        #expect(catalog.count(for: source.id) == 0)
        #expect(catalog.count(for: target.id) == 8)
        #expect(model.selectedCategoryID == nil)
        #expect(model.noticeMessage == "合并已提交，但分类目录刷新失败，请重试刷新")
        #expect(model.errorMessage == nil)
        #expect(model.isSaving == false)
    }

    @Test func 优化进行中禁止保存且结束后全部忙碌状态清理() async {
        let category = 分类(id: 1, name: "产品设计", sortOrder: 10)
        let gate = 分类管理操作闸门()
        let service = 分类管理服务桩(
            列表响应: [
                .success(CategoriesResponse(categories: [category], counts: ["1": 4])),
            ],
            更新响应: [.success(CategoryResponse(category: category))],
            优化响应: [
                .success(CategoryOptimizeResponse(
                    draft: CategoryOptimizeDraft(
                        description: "优化后的分类说明",
                        includeExamples: ["设计方法"],
                        excludeExamples: ["技术教程"]
                    )
                )),
            ],
            优化闸门: gate
        )
        let catalog = CategoryCatalogModel(
            service: service,
            recentStore: 最近分类存储桩()
        )
        catalog.prepareUser(userID: 7)
        await catalog.load()
        let model = CategoryManagementModel(catalog: catalog)
        var draft = CategoryDraft(category: category)
        draft.description = "原始说明"

        let optimizeTask = Task { await model.optimize(draft) }
        await gate.等待开始()
        await model.save(draft, editing: category)
        await gate.释放()
        let optimized = await optimizeTask.value

        #expect(optimized?.description == "优化后的分类说明")
        #expect(model.errorMessage == "分类操作正在进行，请稍后再试")
        #expect(model.isSaving == false)
        #expect(model.isOptimizing == false)
        #expect(await service.最近更新请求次数() == 0)
    }

    @Test func 详细编辑仍保留完整规则字段() async {
        let original = 分类(
            id: 1,
            name: "产品设计",
            description: "产品与体验设计",
            includeExamples: ["设计方法"],
            excludeExamples: ["技术实现"],
            color: "#2F6A4F",
            sortOrder: 10
        )
        let updated = 分类(
            id: 1,
            name: "体验设计",
            description: "关注产品体验与设计方法",
            includeExamples: ["交互设计", "设计研究"],
            excludeExamples: ["纯技术教程"],
            color: "#536CCB",
            sortOrder: 10
        )
        let service = 分类管理服务桩(
            列表响应: [
                .success(CategoriesResponse(categories: [original], counts: ["1": 6])),
            ],
            更新响应: [.success(CategoryResponse(category: updated))]
        )
        let catalog = CategoryCatalogModel(
            service: service,
            recentStore: 最近分类存储桩()
        )
        catalog.prepareUser(userID: 7)
        await catalog.load()
        let model = CategoryManagementModel(catalog: catalog)
        model.editingCategory = original

        var draft = CategoryDraft()
        draft.name = "体验设计"
        draft.description = "关注产品体验与设计方法"
        draft.includeExamples = ["交互设计", "设计研究"]
        draft.excludeExamples = ["纯技术教程"]
        draft.color = "#536CCB"

        await model.save(draft, editing: original)

        #expect(catalog.categories.first == updated)
        #expect(model.editingCategory == nil)
        #expect(model.noticeMessage == "分类已更新")
        let request = try! #require(await service.最近更新请求())
        #expect(request.name == "体验设计")
        #expect(request.description == "关注产品体验与设计方法")
        #expect(request.includeExamples == ["交互设计", "设计研究"])
        #expect(request.excludeExamples == ["纯技术教程"])
        #expect(request.color == "#536CCB")
    }
    @Test func 网络失败会暴露可重试错误且不伪造空目录() async {
        let service = 分类管理服务桩(列表响应: [.failure(.network)])
        let catalog = CategoryCatalogModel(
            service: service,
            recentStore: 最近分类存储桩()
        )
        catalog.prepareUser(userID: 7)
        let model = CategoryManagementModel(catalog: catalog)

        await model.load()

        #expect(catalog.hasLoadedCatalog == false)
        #expect(catalog.categories.isEmpty)
        #expect(model.errorMessage == "无法连接服务器，请检查网络后重试")
    }

    @Test func 服务端同名冲突会保留新增状态并显示真实消息() async {
        let service = 分类管理服务桩(
            列表响应: [
                .success(CategoriesResponse(
                    categories: [分类(id: 1, name: "已有分类", sortOrder: 10)],
                    counts: ["1": 2]
                )),
            ],
            创建响应: [.failure(.categoryConflict(message: "服务端检测到同名分类"))]
        )
        let catalog = CategoryCatalogModel(
            service: service,
            recentStore: 最近分类存储桩()
        )
        catalog.prepareUser(userID: 7)
        await catalog.load()
        let model = CategoryManagementModel(catalog: catalog)
        model.isCreating = true
        var draft = CategoryDraft()
        draft.name = "新分类"

        await model.save(draft, editing: nil)

        #expect(model.errorMessage == "服务端检测到同名分类")
        #expect(model.isCreating)
        #expect(catalog.categories.map(\.id) == [1])
    }

    @Test func 系统分类保持只读() async {
        let systemCategory = 分类(
            id: 3,
            name: "待整理",
            sortOrder: 30,
            isSystem: true
        )
        let service = 分类管理服务桩(
            列表响应: [
                .success(CategoriesResponse(categories: [systemCategory], counts: ["3": 9])),
            ]
        )
        let catalog = CategoryCatalogModel(
            service: service,
            recentStore: 最近分类存储桩()
        )
        catalog.prepareUser(userID: 7)
        await catalog.load()
        let model = CategoryManagementModel(catalog: catalog)
        var draft = CategoryDraft(category: systemCategory)
        draft.name = "被修改"

        await model.save(draft, editing: systemCategory)

        #expect(model.errorMessage == "系统分类不可编辑")
        #expect(catalog.categories == [systemCategory])
    }

    @Test func 切换用户会清空管理页选择与临时弹窗() async {
        let service = 分类管理服务桩(
            列表响应: [
                .success(CategoriesResponse(
                    categories: [分类(id: 1, name: "待整理", sortOrder: 10)],
                    counts: ["1": 2]
                )),
            ]
        )
        let catalog = CategoryCatalogModel(
            service: service,
            recentStore: 最近分类存储桩()
        )
        catalog.prepareUser(userID: 7)
        await catalog.load()
        let model = CategoryManagementModel(catalog: catalog)
        model.select(categoryID: 1)
        model.searchText = "整理"
        model.isCreating = true
        model.editingCategory = catalog.categories.first
        model.deletingCategory = catalog.categories.first

        catalog.prepareUser(userID: 8)
        model.resetForUserChange()

        #expect(model.selectedCategoryID == nil)
        #expect(model.searchText.isEmpty)
        #expect(model.isCreating == false)
        #expect(model.editingCategory == nil)
        #expect(model.deletingCategory == nil)
        #expect(model.errorMessage == nil)
        #expect(model.noticeMessage == nil)
    }

    @Test func 提交中取消后保留可能已创建的显式提示() {
        let catalog = CategoryCatalogModel(
            service: 分类管理服务桩(列表响应: []),
            recentStore: 最近分类存储桩()
        )
        let model = CategoryManagementModel(catalog: catalog)
        let 提示 = "已取消创建。分类可能已在服务器创建，正在刷新分类目录。"
        catalog.presentError(提示)
        model.isCreating = true

        model.cancelCreation()

        #expect(!model.isCreating)
        #expect(model.errorMessage == 提示)
        #expect(catalog.errorMessage == nil)
    }

}

private func 分类(
    id: Int,
    name: String,
    description: String? = nil,
    includeExamples: [String] = [],
    excludeExamples: [String] = [],
    color: String? = nil,
    sortOrder: Int,
    isActive: Bool = true,
    isSystem: Bool = false
) -> ArticleCategory {
    ArticleCategory(
        id: id,
        name: name,
        articleDescription: description,
        includeExamples: includeExamples,
        excludeExamples: excludeExamples,
        color: color,
        sortOrder: sortOrder,
        isActive: isActive,
        isSystem: isSystem
    )
}

private actor 分类管理服务桩: CategoryCatalogServicing {
    private var 列表响应: [Result<CategoriesResponse, AppError>]
    private var 创建响应: [Result<CategoryResponse, AppError>]
    private var 更新响应: [Result<CategoryResponse, AppError>]
    private var 排序响应: [Result<CategoryReorderResponse, AppError>]
    private var 删除响应: [Result<DeleteCategoryResponse, AppError>]
    private var 合并响应: [Result<Void, AppError>]
    private var 优化响应: [Result<CategoryOptimizeResponse, AppError>]
    private let 优化闸门: 分类管理操作闸门?
    private(set) var 更新请求: CategoryMutationRequest?
    private(set) var 更新请求次数 = 0
    private(set) var 排序请求: [Int]?

    init(
        列表响应: [Result<CategoriesResponse, AppError>] = [],
        创建响应: [Result<CategoryResponse, AppError>] = [],
        更新响应: [Result<CategoryResponse, AppError>] = [],
        排序响应: [Result<CategoryReorderResponse, AppError>] = [],
        删除响应: [Result<DeleteCategoryResponse, AppError>] = [],
        合并响应: [Result<Void, AppError>] = [],
        优化响应: [Result<CategoryOptimizeResponse, AppError>] = [],
        优化闸门: 分类管理操作闸门? = nil
    ) {
        self.列表响应 = 列表响应
        self.创建响应 = 创建响应
        self.更新响应 = 更新响应
        self.排序响应 = 排序响应
        self.删除响应 = 删除响应
        self.合并响应 = 合并响应
        self.优化响应 = 优化响应
        self.优化闸门 = 优化闸门
    }

    func list(includeInactive: Bool) async throws -> CategoriesResponse {
        guard !列表响应.isEmpty else { throw AppError.network }
        return try 列表响应.removeFirst().get()
    }

    func create(_ request: CategoryMutationRequest) async throws -> CategoryResponse {
        guard !创建响应.isEmpty else { throw AppError.network }
        return try 创建响应.removeFirst().get()
    }

    func update(categoryID: Int, request: CategoryMutationRequest) async throws -> CategoryResponse {
        更新请求 = request
        更新请求次数 += 1
        guard !更新响应.isEmpty else { throw AppError.network }
        return try 更新响应.removeFirst().get()
    }

    func reorder(categoryIDs: [Int]) async throws -> CategoryReorderResponse {
        排序请求 = categoryIDs
        guard !排序响应.isEmpty else { throw AppError.network }
        return try 排序响应.removeFirst().get()
    }

    func delete(categoryID: Int, targetCategoryID: Int) async throws -> DeleteCategoryResponse {
        guard !删除响应.isEmpty else { throw AppError.network }
        return try 删除响应.removeFirst().get()
    }

    func merge(sourceCategoryID: Int, targetCategoryID: Int) async throws {
        guard !合并响应.isEmpty else { throw AppError.network }
        try 合并响应.removeFirst().get()
    }

    func optimize(_ request: CategoryOptimizeRequest) async throws -> CategoryOptimizeResponse {
        if let 优化闸门 {
            await 优化闸门.标记开始()
            await 优化闸门.等待释放()
        }
        guard !优化响应.isEmpty else { throw AppError.network }
        return try 优化响应.removeFirst().get()
    }

    func 最近更新请求() -> CategoryMutationRequest? {
        更新请求
    }

    func 最近更新请求次数() -> Int {
        更新请求次数
    }

    func 最近排序请求() -> [Int]? {
        排序请求
    }
}

private actor 分类管理操作闸门 {
    private var 已开始 = false
    private var 开始等待者: [CheckedContinuation<Void, Never>] = []
    private var 已释放 = false
    private var 释放等待者: CheckedContinuation<Void, Never>?

    func 标记开始() {
        已开始 = true
        for waiter in 开始等待者 {
            waiter.resume()
        }
        开始等待者.removeAll()
    }

    func 等待开始() async {
        guard !已开始 else { return }
        await withCheckedContinuation { continuation in
            开始等待者.append(continuation)
        }
    }

    func 等待释放() async {
        guard !已释放 else { return }
        await withCheckedContinuation { continuation in
            释放等待者 = continuation
        }
    }

    func 释放() {
        已释放 = true
        释放等待者?.resume()
        释放等待者 = nil
    }
}

@MainActor
private final class 最近分类存储桩: CategoryRecentStoring {
    func load(userID: Int) -> [Int] { [] }
    func save(_ categoryIDs: [Int], userID: Int) {}
}
