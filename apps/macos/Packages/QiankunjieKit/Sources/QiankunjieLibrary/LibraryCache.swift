import Foundation
import QiankunjieCore
import SwiftData

public struct LibraryCacheScope: Hashable, Sendable {
    public let userID: Int?
    public let view: LibraryView
    public let searchText: String
    public let sort: ArticleSort
    public let order: QiankunjieCore.SortOrder
    public let source: String?
    public let categoryId: Int?
    public let page: Int
    public let perPage: Int

    public init(
        userID: Int?,
        view: LibraryView,
        searchText: String,
        sort: ArticleSort,
        order: QiankunjieCore.SortOrder,
        source: String?,
        categoryId: Int?,
        page: Int,
        perPage: Int
    ) {
        self.userID = userID
        self.view = view
        self.searchText = searchText
        self.sort = sort
        self.order = order
        self.source = source
        self.categoryId = categoryId
        self.page = page
        self.perPage = perPage
    }

    public var normalizedIdentity: String {
        query.cacheIdentity
    }

    private var query: LibraryQuery {
        LibraryQuery(
            userId: userID,
            view: view,
            searchText: searchText,
            sort: sort,
            order: order,
            source: source,
            categoryId: categoryId,
            page: page,
            perPage: perPage
        )
    }
}

public protocol LibraryCaching: Sendable {
    func load(scope: LibraryCacheScope) async throws -> ArticleListPage?
    func save(_ page: ArticleListPage, scope: LibraryCacheScope) async throws
    func clear(userID: Int?) async throws
}

public extension LibraryCaching {
    static var empty: any LibraryCaching {
        EmptyLibraryCache()
    }
}

public struct EmptyLibraryCache: LibraryCaching, Sendable {
    public init() {}

    public func load(scope: LibraryCacheScope) async throws -> ArticleListPage? {
        nil
    }

    public func save(_ page: ArticleListPage, scope: LibraryCacheScope) async throws {}

    public func clear(userID: Int?) async throws {}
}

public actor LibraryCache: LibraryCaching {
    private let container: ModelContainer

    public init(inMemory: Bool = false) throws {
        let configuration = ModelConfiguration(isStoredInMemoryOnly: inMemory)
        container = try ModelContainer(
            for: CachedLibraryPage.self,
            configurations: configuration
        )
    }

    public static func inMemory() throws -> LibraryCache {
        try LibraryCache(inMemory: true)
    }

    public static func scope(
        for query: LibraryQuery,
        userId: Int?
    ) -> LibraryCacheScope {
        LibraryCacheScope(
            userID: userId ?? query.userId,
            view: query.view,
            searchText: query.searchText,
            sort: query.sort,
            order: query.order,
            source: query.source,
            categoryId: query.categoryId,
            page: query.page,
            perPage: query.perPage
        )
    }

    public func load(scope: LibraryCacheScope) async throws -> ArticleListPage? {
        guard scope.userID != nil else {
            return nil
        }

        let context = ModelContext(container)
        let scopeKey = scope.normalizedIdentity
        let descriptor = FetchDescriptor<CachedLibraryPage>(
            predicate: #Predicate { cached in
                cached.scopeKey == scopeKey
            }
        )
        guard let cached = try context.fetch(descriptor).first else {
            return nil
        }
        return try JSONDecoder.qiankunjie.decode(
            ArticleListPage.self,
            from: cached.payload
        )
    }

    public func save(
        _ page: ArticleListPage,
        scope: LibraryCacheScope
    ) async throws {
        guard scope.userID != nil else {
            return
        }

        let encoder = JSONEncoder()
        encoder.dateEncodingStrategy = .iso8601
        encoder.keyEncodingStrategy = .convertToSnakeCase
        encoder.outputFormatting = .sortedKeys
        let payload = try encoder.encode(page)

        let context = ModelContext(container)
        let scopeKey = scope.normalizedIdentity
        let descriptor = FetchDescriptor<CachedLibraryPage>(
            predicate: #Predicate { cached in
                cached.scopeKey == scopeKey
            }
        )
        if let existing = try context.fetch(descriptor).first {
            existing.payload = payload
            existing.cachedAt = Date()
        } else {
            context.insert(
                CachedLibraryPage(
                    scopeKey: scopeKey,
                    userID: scope.userID ?? -1,
                    payload: payload
                )
            )
        }
        try context.save()
    }

    public func clear(userID: Int?) async throws {
        guard let userID else {
            return
        }

        let context = ModelContext(container)
        let descriptor = FetchDescriptor<CachedLibraryPage>(
            predicate: #Predicate { cached in
                cached.userID == userID
            }
        )
        for cached in try context.fetch(descriptor) {
            context.delete(cached)
        }
        try context.save()
    }
}

@Model
private final class CachedLibraryPage {
    @Attribute(.unique) var scopeKey: String
    var userID: Int
    var payload: Data
    var cachedAt: Date

    init(
        scopeKey: String,
        userID: Int,
        payload: Data
    ) {
        self.scopeKey = scopeKey
        self.userID = userID
        self.payload = payload
        self.cachedAt = Date()
    }
}
