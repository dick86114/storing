import Foundation
import QiankunjieCore
import Testing
@testable import QiankunjieMac

@MainActor
struct BulkCategoryPresentationTests {
    @Test func 手动分类成功后安排目录计数刷新() async throws {
        let category = ArticleCategory(id: 1, name: "产品设计", sortOrder: 10)
        let service = 展示分类服务(列表响应: [
            CategoriesResponse(categories: [category], counts: ["1": 1]),
            CategoriesResponse(categories: [category], counts: ["1": 4]),
        ])
        let catalog = CategoryCatalogModel(
            service: service,
            recentStore: 展示最近分类存储()
        )
        catalog.prepareUser(userID: 7)
        await catalog.load()
        #expect(catalog.count(for: 1) == 1)

        let refresh = try #require(BulkCategoryCatalogRefresh.scheduleRefresh(
            outcome: .success(succeededCount: 1, skippedCount: 0),
            catalog: catalog,
            expectedUserID: 7
        ))
        await refresh.value

        #expect(catalog.count(for: 1) == 4)
    }

    @Test func 手动分类部分成功且仍有成功项时刷新计数() async throws {
        let category = ArticleCategory(id: 1, name: "产品设计", sortOrder: 10)
        let service = 展示分类服务(列表响应: [
            CategoriesResponse(categories: [category], counts: ["1": 2]),
            CategoriesResponse(categories: [category], counts: ["1": 5]),
        ])
        let catalog = CategoryCatalogModel(
            service: service,
            recentStore: 展示最近分类存储()
        )
        catalog.prepareUser(userID: 7)
        await catalog.load()

        let refresh = try #require(BulkCategoryCatalogRefresh.scheduleRefresh(
            outcome: .partial(
                succeededCount: 1,
                skippedCount: 1,
                failedCount: 1,
                message: "部分完成"
            ),
            catalog: catalog,
            expectedUserID: 7
        ))
        await refresh.value

        #expect(catalog.count(for: 1) == 5)
    }

    @Test func 无成功项或用户已切换时不刷新计数() {
        let catalog = CategoryCatalogModel(
            service: 展示分类服务(列表响应: []),
            recentStore: 展示最近分类存储()
        )
        catalog.prepareUser(userID: 8)

        #expect(BulkCategoryCatalogRefresh.scheduleRefresh(
            outcome: .partial(
                succeededCount: 0,
                skippedCount: 1,
                failedCount: 1,
                message: "全部失败"
            ),
            catalog: catalog,
            expectedUserID: 8
        ) == nil)
        #expect(BulkCategoryCatalogRefresh.scheduleRefresh(
            outcome: .success(succeededCount: 1, skippedCount: 0),
            catalog: catalog,
            expectedUserID: 7
        ) == nil)
    }

    @Test func 分类菜单加载时显示加载文案() {
        let state = LibraryCategoryMenuPolicy.state(
            isLoading: true,
            errorMessage: nil,
            activeCategoryCount: 0
        )

        #expect(state == .loading)
        #expect(state.message == "正在加载分类…")
    }

    @Test func 分类菜单无启用项时显示空态() {
        let state = LibraryCategoryMenuPolicy.state(
            isLoading: false,
            errorMessage: nil,
            activeCategoryCount: 0
        )

        #expect(state == .empty)
        #expect(state.message == "暂无启用分类")
    }

    @Test func 分类菜单加载失败时显示可重试文案() {
        let state = LibraryCategoryMenuPolicy.state(
            isLoading: false,
            errorMessage: "网络失败",
            activeCategoryCount: 0
        )

        #expect(state == .failure)
        #expect(state.message == "分类加载失败，重新加载")
    }

    @Test func 分类菜单有启用项时只显示分类列表() {
        let state = LibraryCategoryMenuPolicy.state(
            isLoading: false,
            errorMessage: "刷新失败",
            activeCategoryCount: 2
        )

        #expect(state == .ready)
        #expect(state.message == nil)
    }
}

private actor 展示分类服务: CategoryCatalogServicing {
    private var 列表响应: [CategoriesResponse]

    init(列表响应: [CategoriesResponse]) {
        self.列表响应 = 列表响应
    }

    func list(includeInactive: Bool) async throws -> CategoriesResponse {
        guard !列表响应.isEmpty else { throw 展示测试错误.缺少列表响应 }
        return 列表响应.removeFirst()
    }

    func create(_ request: CategoryMutationRequest) async throws -> CategoryResponse {
        throw 展示测试错误.未实现
    }

    func update(categoryID: Int, request: CategoryMutationRequest) async throws -> CategoryResponse {
        throw 展示测试错误.未实现
    }

    func reorder(categoryIDs: [Int]) async throws -> CategoryReorderResponse {
        throw 展示测试错误.未实现
    }

    func delete(categoryID: Int, targetCategoryID: Int) async throws -> DeleteCategoryResponse {
        throw 展示测试错误.未实现
    }

    func merge(sourceCategoryID: Int, targetCategoryID: Int) async throws {
        throw 展示测试错误.未实现
    }

    func optimize(_ request: CategoryOptimizeRequest) async throws -> CategoryOptimizeResponse {
        throw 展示测试错误.未实现
    }
}

@MainActor
private final class 展示最近分类存储: CategoryRecentStoring {
    func load(userID: Int) -> [Int] { [] }
    func save(_ categoryIDs: [Int], userID: Int) {}
}

private enum 展示测试错误: Error {
    case 缺少列表响应
    case 未实现
}
