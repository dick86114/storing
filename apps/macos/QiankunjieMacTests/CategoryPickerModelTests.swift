import Foundation
import QiankunjieCore
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

    @Test func 选择器中的分类已被删除时显示错误并刷新目录() async {
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
            .failure(message: managementErrorMessage(for: AppError.contentUnavailable))
        }

        #expect(!成功)
        #expect(model.errorMessage == "分类已失效")
        #expect(await service.列表请求次数() == 2)
        #expect(catalog.categories.map(\.id) == [2])
        #expect(catalog.recentCategoryIDs == [2])
        #expect(!model.isSubmitting)
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
}

@MainActor
private func 准备分类目录(
    service: 选择器分类服务桩,
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

private actor 选择器分类服务桩: CategoryCatalogServicing {
    private var 列表响应: [Result<CategoriesResponse, 选择器服务测试错误>]
    private var 创建响应: [Result<CategoryResponse, 选择器服务测试错误>]
    private var 列表请求计数 = 0
    private var 创建请求名称: [String] = []

    init(
        列表响应: [CategoriesResponse],
        创建响应: [Result<CategoryResponse, 选择器服务测试错误>] = []
    ) {
        self.列表响应 = 列表响应.map(Result.success)
        self.创建响应 = 创建响应
    }

    func list(includeInactive: Bool) async throws -> CategoriesResponse {
        列表请求计数 += 1
        guard !列表响应.isEmpty else { throw 选择器服务测试错误.缺少响应 }
        return try 列表响应.removeFirst().get()
    }

    func create(_ request: CategoryMutationRequest) async throws -> CategoryResponse {
        创建请求名称.append(request.name ?? "")
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
