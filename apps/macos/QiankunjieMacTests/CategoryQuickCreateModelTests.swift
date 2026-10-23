import Foundation
import QiankunjieCore
import Testing
@testable import QiankunjieMac

@MainActor
struct CategoryQuickCreateModelTests {
    @Test func 提交中取消不会跳转并会在请求结束后刷新目录和提示() async {
        let 初始分类 = 分类(id: 1, name: "工程实践", sortOrder: 10)
        let 可能已创建分类 = 分类(id: 2, name: "项目复盘", sortOrder: 20)
        let service = 快速创建分类服务(
            列表响应: [
                CategoriesResponse(categories: [初始分类], counts: ["1": 1]),
                CategoriesResponse(categories: [初始分类, 可能已创建分类], counts: ["1": 1, "2": 0]),
            ],
            创建结果: .success(CategoryResponse(category: 可能已创建分类)),
            暂停创建: true
        )
        let catalog = 创建快速创建目录(service: service)
        catalog.prepareUser(userID: 7)
        await catalog.load()
        var 已创建分类ID: [Int] = []
        let model = CategoryQuickCreateModel(
            catalog: catalog,
            initialName: "项目复盘"
        )

        let 提交任务 = try! #require(model.startSubmission())
        await service.等待创建请求开始()
        let 导航任务 = Task { @MainActor in
            if let category = await 提交任务.value {
                已创建分类ID.append(category.id)
            }
        }
        model.cancel()
        await service.放行创建响应()
        await 导航任务.value
        await model.waitForCancellationRefreshCompletion()

        #expect(已创建分类ID.isEmpty)
        #expect(catalog.activeCategories.contains(可能已创建分类))
        #expect(catalog.errorMessage?.contains("取消创建") == true)
        #expect(catalog.errorMessage?.contains("可能已在服务器创建") == true)
        #expect(catalog.errorMessage?.contains("刷新分类目录") == true)
    }

    @Test func 服务端同名冲突保留草稿并支持使用现有分类() async {
        let 现有分类 = 分类(id: 2, name: "产品设计", sortOrder: 20)
        let 冲突消息 = "已存在同名启用分类，请换一个名称"
        let service = 快速创建分类服务(
            列表响应: [
                CategoriesResponse(categories: [分类(id: 1, name: "工程实践", sortOrder: 10)], counts: ["1": 1]),
                CategoriesResponse(categories: [分类(id: 1, name: "工程实践", sortOrder: 10), 现有分类], counts: ["1": 1, "2": 0]),
            ],
            创建结果: .failure(.categoryConflict(message: 冲突消息))
        )
        let catalog = 创建快速创建目录(service: service)
        catalog.prepareUser(userID: 7)
        await catalog.load()
        let model = CategoryQuickCreateModel(
            catalog: catalog,
            initialName: " 产品设计 "
        )

        let 提交结果 = try! #require(model.startSubmission())
        #expect(await 提交结果.value == nil)

        #expect(model.draft.name == "产品设计")
        #expect(model.conflictSuggestion == 现有分类)
        #expect(await service.列表请求数() == 2)
        #expect(await service.已创建分类名称() == ["产品设计"])

        let 使用结果 = model.useExistingCategory()

        #expect(使用结果 == 现有分类)
    }

    @Test func 输入同名分类时直接显示现有分类建议且禁止重复创建() async {
        let 现有分类 = 分类(id: 2, name: "产品设计", sortOrder: 20)
        let service = 快速创建分类服务(
            列表响应: [
                CategoriesResponse(categories: [现有分类], counts: ["2": 3]),
            ],
            创建结果: .success(CategoryResponse(category: 现有分类))
        )
        let catalog = 创建快速创建目录(service: service)
        catalog.prepareUser(userID: 7)
        await catalog.load()
        let model = CategoryQuickCreateModel(
            catalog: catalog,
            initialName: "产品设计"
        )

        #expect(model.sameNameSuggestion == 现有分类)
        #expect(!model.canSubmit)
    }
}

private func 分类(
    id: Int,
    name: String,
    sortOrder: Int
) -> ArticleCategory {
    ArticleCategory(id: id, name: name, sortOrder: sortOrder)
}

@MainActor
private func 创建快速创建目录(service: 快速创建分类服务) -> CategoryCatalogModel {
    let catalog = CategoryCatalogModel(
        service: service,
        recentStore: 快速创建最近分类存储()
    )
    return catalog
}

private actor 快速创建分类服务: CategoryCatalogServicing {
    private var 列表响应: [CategoriesResponse]
    private let 创建结果: Result<CategoryResponse, AppError>
    private let 暂停创建: Bool
    private var 列表请求计数 = 0
    private var 创建请求已开始 = false
    private var 等待创建开始: CheckedContinuation<Void, Never>?
    private var 等待创建放行: CheckedContinuation<Void, Never>?
    private var 创建请求名称: [String] = []

    init(
        列表响应: [CategoriesResponse],
        创建结果: Result<CategoryResponse, AppError>,
        暂停创建: Bool = false
    ) {
        self.列表响应 = 列表响应
        self.创建结果 = 创建结果
        self.暂停创建 = 暂停创建
    }

    func list(includeInactive: Bool) async throws -> CategoriesResponse {
        列表请求计数 += 1
        guard !列表响应.isEmpty else { throw 快速创建测试错误.缺少响应 }
        return 列表响应.removeFirst()
    }

    func create(_ request: CategoryMutationRequest) async throws -> CategoryResponse {
        创建请求名称.append(request.name ?? "")
        创建请求已开始 = true
        等待创建开始?.resume()
        等待创建开始 = nil
        if 暂停创建 {
            await withCheckedContinuation { continuation in
                等待创建放行 = continuation
            }
        }
        return try 创建结果.get()
    }

    func update(categoryID: Int, request: CategoryMutationRequest) async throws -> CategoryResponse {
        throw 快速创建测试错误.未实现
    }

    func reorder(categoryIDs: [Int]) async throws -> CategoryReorderResponse {
        throw 快速创建测试错误.未实现
    }

    func delete(categoryID: Int, targetCategoryID: Int) async throws -> DeleteCategoryResponse {
        throw 快速创建测试错误.未实现
    }

    func merge(sourceCategoryID: Int, targetCategoryID: Int) async throws {
        throw 快速创建测试错误.未实现
    }

    func optimize(_ request: CategoryOptimizeRequest) async throws -> CategoryOptimizeResponse {
        throw 快速创建测试错误.未实现
    }

    func 等待创建请求开始() async {
        if 创建请求已开始 { return }
        await withCheckedContinuation { continuation in
            等待创建开始 = continuation
        }
    }

    func 放行创建响应() {
        等待创建放行?.resume()
        等待创建放行 = nil
    }

    func 等待列表请求数(_ 数量: Int) async {
        for _ in 0..<100 {
            if 列表请求计数 >= 数量 { return }
            try? await Task.sleep(for: .milliseconds(10))
        }
    }

    func 列表请求数() -> Int {
        列表请求计数
    }

    func 已创建分类名称() -> [String] {
        创建请求名称
    }
}

@MainActor
private final class 快速创建最近分类存储: CategoryRecentStoring {
    func load(userID: Int) -> [Int] { [] }
    func save(_ categoryIDs: [Int], userID: Int) {}
}

private enum 快速创建测试错误: Error {
    case 缺少响应
    case 未实现
}
