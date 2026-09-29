import QiankunjieCore
import Testing
@testable import QiankunjieLibrary

struct LibraryCacheTests {
    @Test func 缓存读取不会返回其他用户的数据行() async throws {
        let cache = try LibraryCache.inMemory()

        try await cache.save(
            .fixture(ids: [1, 2], totalPages: 1),
            scope: .fixture(userID: 7, view: .inbox)
        )

        #expect(
            try await cache.load(scope: .fixture(userID: 8, view: .inbox)) == nil
        )
        #expect(
            try await cache.load(scope: .fixture(userID: 7, view: .inbox))?.articles.map(\.id)
                == [1, 2]
        )
    }

    @Test func 缓存作用域包含查询过滤排序分页和规范化搜索() {
        let base = LibraryCacheScope(
            userID: 7,
            view: .archive,
            searchText: " swift ",
            sort: .collected,
            order: .desc,
            source: nil,
            categoryId: nil,
            page: 1,
            perPage: 20
        )
        let normalized = LibraryCacheScope(
            userID: 7,
            view: .archive,
            searchText: "Swift",
            sort: .collected,
            order: .desc,
            source: nil,
            categoryId: nil,
            page: 1,
            perPage: 20
        )
        let changedFields: [LibraryCacheScope] = [
            LibraryCacheScope(userID: 8, view: .archive, searchText: "", sort: .collected, order: .desc, source: nil, categoryId: nil, page: 1, perPage: 20),
            LibraryCacheScope(userID: 7, view: .inbox, searchText: "", sort: .collected, order: .desc, source: nil, categoryId: nil, page: 1, perPage: 20),
            LibraryCacheScope(userID: 7, view: .archive, searchText: "swiftui", sort: .collected, order: .desc, source: nil, categoryId: nil, page: 1, perPage: 20),
            LibraryCacheScope(userID: 7, view: .archive, searchText: "", sort: .published, order: .desc, source: nil, categoryId: nil, page: 1, perPage: 20),
            LibraryCacheScope(userID: 7, view: .archive, searchText: "", sort: .collected, order: .asc, source: nil, categoryId: nil, page: 1, perPage: 20),
            LibraryCacheScope(userID: 7, view: .archive, searchText: "", sort: .collected, order: .desc, source: "少数派", categoryId: nil, page: 1, perPage: 20),
            LibraryCacheScope(userID: 7, view: .archive, searchText: "", sort: .collected, order: .desc, source: nil, categoryId: 3, page: 1, perPage: 20),
            LibraryCacheScope(userID: 7, view: .archive, searchText: "", sort: .collected, order: .desc, source: nil, categoryId: nil, page: 2, perPage: 20),
            LibraryCacheScope(userID: 7, view: .archive, searchText: "", sort: .collected, order: .desc, source: nil, categoryId: nil, page: 1, perPage: 50),
        ]

        #expect(base.normalizedIdentity == normalized.normalizedIdentity)
        for changed in changedFields {
            #expect(base.normalizedIdentity != changed.normalizedIdentity)
        }
    }

    @Test func 保存同作用域会替换旧页且可按用户清理() async throws {
        let cache = try LibraryCache.inMemory()
        let scope = LibraryCacheScope.fixture(userID: 7, view: .inbox)
        let secondPageScope = LibraryCacheScope(
            userID: 7,
            view: .inbox,
            searchText: "",
            sort: .collected,
            order: .desc,
            source: nil,
            categoryId: nil,
            page: 2,
            perPage: 20
        )

        try await cache.save(.fixture(ids: [1], totalPages: 1), scope: scope)
        try await cache.save(.fixture(ids: [2], totalPages: 1), scope: scope)
        try await cache.save(.fixture(ids: [3], page: 2, totalPages: 2), scope: secondPageScope)

        #expect(try await cache.load(scope: scope)?.articles.map(\.id) == [2])
        try await cache.clear(userID: 7)
        #expect(try await cache.load(scope: scope) == nil)
    }
}

private extension LibraryCacheScope {
    static func fixture(userID: Int?, view: LibraryView) -> Self {
        Self(
            userID: userID,
            view: view,
            searchText: "",
            sort: .collected,
            order: .desc,
            source: nil,
            categoryId: nil,
            page: 1,
            perPage: 20
        )
    }
}

private extension ArticleListPage {
    static func fixture(ids: [Int], page: Int = 1, totalPages: Int) -> Self {
        ArticleListPage(
            articles: ids.map { ArticleCard(id: $0, title: "文章 \($0)") },
            total: ids.count * max(1, totalPages),
            page: page,
            perPage: 20,
            totalPages: totalPages
        )
    }
}
