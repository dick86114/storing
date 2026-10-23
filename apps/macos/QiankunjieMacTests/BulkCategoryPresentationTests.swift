import Foundation
import QiankunjieCore
import Testing
@testable import QiankunjieMac

@MainActor
struct BulkCategoryPresentationTests {
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
