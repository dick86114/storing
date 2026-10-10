import Foundation
import QiankunjieCore
import QiankunjieNetworking

private struct CategoryFiltersResponse: Decodable {
    let filters: [LibraryCategoryFilter]

    init(from decoder: any Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        let categories = try container.decode([ArticleCategory].self, forKey: .categories)
        let counts = try container.decodeIfPresent([String: Int].self, forKey: .counts) ?? [:]
        filters = categories.map { category in
            LibraryCategoryFilter(
                category: category,
                count: counts[String(category.id)] ?? 0
            )
        }
    }

    enum CodingKeys: String, CodingKey {
        case categories
        case counts
    }
}

public protocol LibraryNetworkClient: Sendable {
    func page(
        _ request: APIRequest,
        authenticated: Bool
    ) async throws -> ArticleListPage
    func counts(
        _ request: APIRequest,
        authenticated: Bool
    ) async throws -> ArticleCounts
    func sources(
        _ request: APIRequest,
        authenticated: Bool
    ) async throws -> [LibrarySource]
    func categoryFilters(
        _ request: APIRequest,
        authenticated: Bool
    ) async throws -> [LibraryCategoryFilter]
    func sendBulkAction(
        _ action: ArticleBulkAction,
        articleIDs: [Int]
    ) async throws -> ArticleBulkActionResult
    func sendBulkCategory(
        articleIDs: [Int],
        categoryID: Int
    ) async throws -> ArticleBulkActionResult
    func sendBulkRegenerateAI(
        articleIDs: [Int],
        includeCategory: Bool
    ) async throws -> ArticleBulkAIResult
    func sendCreateBulkExport(
        articleIDs: [Int]
    ) async throws -> ArticleBulkExportJob
    func sendBulkExport(
        jobID: Int
    ) async throws -> ArticleBulkExportJob
}

private struct APIClientLibraryNetworkClient: LibraryNetworkClient {
    let apiClient: APIClient

    func page(
        _ request: APIRequest,
        authenticated: Bool
    ) async throws -> ArticleListPage {
        try await apiClient.send(request, authenticated: authenticated)
    }

    func counts(
        _ request: APIRequest,
        authenticated: Bool
    ) async throws -> ArticleCounts {
        try await apiClient.send(request, authenticated: authenticated)
    }

    func sources(
        _ request: APIRequest,
        authenticated: Bool
    ) async throws -> [LibrarySource] {
        try await apiClient.send(request, authenticated: authenticated)
    }

    func categoryFilters(
        _ request: APIRequest,
        authenticated: Bool
    ) async throws -> [LibraryCategoryFilter] {
        let response: CategoryFiltersResponse = try await apiClient.send(request, authenticated: authenticated)
        return response.filters
    }

    func sendBulkAction(
        _ action: ArticleBulkAction,
        articleIDs: [Int]
    ) async throws -> ArticleBulkActionResult {
        try await apiClient.send(
            .post("articles/bulk-actions", body: try JSONEncoder.qiankunjie.encode(BulkActionRequest(action: action, articleIDs: articleIDs))),
            authenticated: true
        )
    }

    func sendBulkCategory(
        articleIDs: [Int],
        categoryID: Int
    ) async throws -> ArticleBulkActionResult {
        try await apiClient.send(
            .post("articles/bulk-category", body: try JSONEncoder.qiankunjie.encode(BulkCategoryRequest(articleIDs: articleIDs, categoryID: categoryID))),
            authenticated: true
        )
    }

    func sendBulkRegenerateAI(
        articleIDs: [Int],
        includeCategory: Bool
    ) async throws -> ArticleBulkAIResult {
        try await apiClient.send(
            .post("articles/bulk-regenerate-ai", body: try JSONEncoder.qiankunjie.encode(BulkAIRequest(articleIDs: articleIDs, includeCategory: includeCategory))),
            authenticated: true
        )
    }

    func sendCreateBulkExport(
        articleIDs: [Int]
    ) async throws -> ArticleBulkExportJob {
        try await apiClient.send(
            .post("articles/bulk-export", body: try JSONEncoder.qiankunjie.encode(BulkExportRequest(articleIDs: articleIDs))),
            authenticated: true
        )
    }

    func sendBulkExport(
        jobID: Int
    ) async throws -> ArticleBulkExportJob {
        try await apiClient.send(.get("articles/bulk-export/\(jobID)"), authenticated: true)
    }
}

public protocol LibraryLoading: Sendable {
    func load(_ query: LibraryQuery) async throws -> ArticleListPage
    func loadCounts(userID: Int?) async throws -> ArticleCounts
    func loadSources(userID: Int?) async throws -> [LibrarySource]
    func loadCategoryFilters(userID: Int?) async throws -> [LibraryCategoryFilter]
}

public protocol LibraryBulkOperating: Sendable {
    func runBulkAction(_ action: ArticleBulkAction, articleIDs: [Int]) async throws -> ArticleBulkActionResult
    func runBulkCategory(articleIDs: [Int], categoryID: Int) async throws -> ArticleBulkActionResult
    func runBulkRegenerateAI(articleIDs: [Int], includeCategory: Bool) async throws -> ArticleBulkAIResult
    func runCreateBulkExport(articleIDs: [Int]) async throws -> ArticleBulkExportJob
    func runBulkExportJob(jobID: Int) async throws -> ArticleBulkExportJob
}

public struct LibrarySource: Codable, Hashable, Identifiable, Sendable {
    public let source: String
    public let count: Int
    public let latestCreatedAt: Date?

    public var id: String {
        source
    }

    public init(
        source: String,
        count: Int,
        latestCreatedAt: Date?
    ) {
        self.source = source
        self.count = count
        self.latestCreatedAt = latestCreatedAt
    }

    enum CodingKeys: String, CodingKey {
        case source
        case count
        case latestCreatedAt
    }
}

public struct LibraryCategoryFilter: Codable, Hashable, Identifiable, Sendable {
    public let category: ArticleCategory
    public let count: Int

    public var id: Int { category.id }
    public var name: String { category.name }
    public var color: String? { category.color }

    public init(category: ArticleCategory, count: Int) {
        self.category = category
        self.count = count
    }
}

public struct LibraryRepository: LibraryLoading, Sendable {
    private let networkClient: any LibraryNetworkClient

    public init(apiClient: APIClient = APIClient()) {
        self.networkClient = APIClientLibraryNetworkClient(apiClient: apiClient)
    }

    init(networkClient: any LibraryNetworkClient) {
        self.networkClient = networkClient
    }

    public func load(_ query: LibraryQuery) async throws -> ArticleListPage {
        try await networkClient.page(
            makePageRequest(query),
            authenticated: query.userId != nil
        )
    }

    public func loadCounts(userID: Int?) async throws -> ArticleCounts {
        try await networkClient.counts(
            .get("counts"),
            authenticated: userID != nil
        )
    }

    public func loadSources(userID: Int?) async throws -> [LibrarySource] {
        try await networkClient.sources(
            .get(
                "sources",
                queryItems: [
                    URLQueryItem(name: "sort", value: "count"),
                    URLQueryItem(name: "order", value: "desc"),
                ]
            ),
            authenticated: userID != nil
        )
    }

    public func loadCategoryFilters(userID: Int?) async throws -> [LibraryCategoryFilter] {
        try await networkClient.categoryFilters(
            .get("categories"),
            authenticated: userID != nil
        )
    }

    private func makePageRequest(_ query: LibraryQuery) -> APIRequest {
        let searchText = normalizedSearch(query.searchText)
        guard !searchText.isEmpty else {
            var queryItems = [
                URLQueryItem(name: "view", value: query.view.rawValue),
                URLQueryItem(name: "page", value: String(query.page)),
                URLQueryItem(name: "perPage", value: String(query.perPage)),
                URLQueryItem(name: "sort", value: query.sort.rawValue),
                URLQueryItem(name: "order", value: query.order.rawValue),
            ]
            if query.view == .published, query.userId != nil {
                queryItems.append(URLQueryItem(name: "scope", value: "mine"))
            }
            if let source = query.source?.trimmingCharacters(in: .whitespacesAndNewlines),
               !source.isEmpty {
                queryItems.append(URLQueryItem(name: "category", value: source))
            }
            if let categoryId = query.categoryId {
                queryItems.append(
                    URLQueryItem(name: "categoryId", value: String(categoryId))
                )
            }
            return .get("articles", queryItems: queryItems)
        }

        return .get(
            "search",
            queryItems: [
                URLQueryItem(name: "q", value: searchText),
                URLQueryItem(name: "page", value: String(query.page)),
                URLQueryItem(name: "perPage", value: String(query.perPage)),
            ]
        )
    }

    private func normalizedSearch(_ text: String) -> String {
        text.components(separatedBy: .whitespacesAndNewlines)
            .filter { !$0.isEmpty }
            .joined(separator: " ")
    }
}

extension LibraryRepository: LibraryBulkOperating {
    public func runBulkAction(
        _ action: ArticleBulkAction,
        articleIDs: [Int]
    ) async throws -> ArticleBulkActionResult {
        let client: any LibraryNetworkClient = networkClient
        return try await client.sendBulkAction(action, articleIDs: articleIDs)
    }

    public func runBulkCategory(
        articleIDs: [Int],
        categoryID: Int
    ) async throws -> ArticleBulkActionResult {
        let client: any LibraryNetworkClient = networkClient
        return try await client.sendBulkCategory(articleIDs: articleIDs, categoryID: categoryID)
    }

    public func runBulkRegenerateAI(
        articleIDs: [Int],
        includeCategory: Bool
    ) async throws -> ArticleBulkAIResult {
        let client: any LibraryNetworkClient = networkClient
        return try await client.sendBulkRegenerateAI(articleIDs: articleIDs, includeCategory: includeCategory)
    }

    public func runCreateBulkExport(articleIDs: [Int]) async throws -> ArticleBulkExportJob {
        let client: any LibraryNetworkClient = networkClient
        return try await client.sendCreateBulkExport(articleIDs: articleIDs)
    }

    public func runBulkExportJob(jobID: Int) async throws -> ArticleBulkExportJob {
        let client: any LibraryNetworkClient = networkClient
        return try await client.sendBulkExport(jobID: jobID)
    }
}
