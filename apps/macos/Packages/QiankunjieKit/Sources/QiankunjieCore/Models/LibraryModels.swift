import Foundation

public enum LibraryView: String, Codable, Hashable, Sendable {
    case inbox
    case favorites
    case archive
    case published
}

public enum ArticleSort: String, Codable, Hashable, Sendable {
    case collected
    case published
    case favorited
    case archived
}

public enum SortOrder: String, Codable, Hashable, Sendable {
    case asc
    case desc
}

public struct LibraryQuery: Codable, Hashable, Sendable {
    public let userId: Int?
    public let view: LibraryView
    public let searchText: String
    public let sort: ArticleSort
    public let order: SortOrder
    public let source: String?
    public let categoryId: Int?
    public let page: Int
    public let perPage: Int

    public init(
        userId: Int? = nil,
        view: LibraryView,
        searchText: String,
        sort: ArticleSort,
        order: SortOrder,
        source: String? = nil,
        categoryId: Int? = nil,
        page: Int = 1,
        perPage: Int = 20
    ) {
        self.userId = userId
        self.view = view
        self.searchText = searchText
        self.sort = sort
        self.order = order
        self.source = source
        self.categoryId = categoryId
        self.page = page
        self.perPage = perPage
    }

    public var cacheIdentity: String {
        struct CacheIdentity: Codable, Hashable, Sendable {
            let userId: Int?
            let view: LibraryView
            let searchText: String
            let sort: ArticleSort
            let order: SortOrder
            let categoryId: Int?
            let source: String?
            let page: Int
            let perPage: Int
        }

        let identity = CacheIdentity(
            userId: userId,
            view: view,
            searchText: searchText
                .components(separatedBy: .whitespacesAndNewlines)
                .filter { !$0.isEmpty }
                .joined(separator: " ")
                .lowercased(),
            sort: sort,
            order: order,
            categoryId: categoryId,
            source: source,
            page: page,
            perPage: perPage
        )
        let encoder = JSONEncoder()
        encoder.outputFormatting = .sortedKeys
        guard let data = try? encoder.encode(identity) else { return "" }
        return String(decoding: data, as: UTF8.self)
    }

}
