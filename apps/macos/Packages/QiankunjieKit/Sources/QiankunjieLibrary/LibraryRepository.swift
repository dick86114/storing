import Foundation
import QiankunjieCore
import QiankunjieNetworking

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
}

public protocol LibraryLoading: Sendable {
    func load(_ query: LibraryQuery) async throws -> ArticleListPage
    func loadCounts(userID: Int?) async throws -> ArticleCounts
    func loadSources(userID: Int?) async throws -> [LibrarySource]
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
