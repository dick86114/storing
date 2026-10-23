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

    @Test func 合并分类后源分类从共享目录移除() async {
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
                    categories: [分类(id: 2, name: "保留分类", sortOrder: 20)],
                    counts: ["2": 8]
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

        #expect(catalog.categories.map(\.id) == [2])
        #expect(catalog.count(for: 2) == 8)
        #expect(model.selectedCategoryID == nil)
        #expect(model.noticeMessage == "分类已合并到“保留分类”")
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
    private(set) var 更新请求: CategoryMutationRequest?
    private(set) var 排序请求: [Int]?

    init(
        列表响应: [Result<CategoriesResponse, AppError>] = [],
        创建响应: [Result<CategoryResponse, AppError>] = [],
        更新响应: [Result<CategoryResponse, AppError>] = [],
        排序响应: [Result<CategoryReorderResponse, AppError>] = [],
        删除响应: [Result<DeleteCategoryResponse, AppError>] = [],
        合并响应: [Result<Void, AppError>] = []
    ) {
        self.列表响应 = 列表响应
        self.创建响应 = 创建响应
        self.更新响应 = 更新响应
        self.排序响应 = 排序响应
        self.删除响应 = 删除响应
        self.合并响应 = 合并响应
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
        throw AppError.network
    }

    func 最近更新请求() -> CategoryMutationRequest? {
        更新请求
    }

    func 最近排序请求() -> [Int]? {
        排序请求
    }
}

@MainActor
private final class 最近分类存储桩: CategoryRecentStoring {
    func load(userID: Int) -> [Int] { [] }
    func save(_ categoryIDs: [Int], userID: Int) {}
}
